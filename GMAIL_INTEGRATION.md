# Guide: Implementing Gmail Features

This document provides a step-by-step guide for integrating all required Gmail functionalities, from initial setup in the Google Cloud Platform to handling real-time email processing in the Next.js application.

---

## 1. Google Cloud Platform (GCP) Setup

Before writing any code, you must configure your Google Cloud project to get the necessary credentials and enable the APIs.

### Step 1: Create Project & Enable APIs

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **new project** (e.g., "AI Email Sorter").
3.  Navigate to **APIs & Services > Library**.
4.  Search for and **Enable** the following two APIs:
    * **Gmail API**
    * **Cloud Pub/Sub API** (This is for the real-time push notifications).

### Step 2: Configure OAuth Consent Screen

This screen is what users see when they grant your app access to their Gmail account.

1.  Navigate to **APIs & Services > OAuth consent screen**.
2.  **User Type:** Select **External**.
3.  **App Information:**
    * **App name:** "AI Email Sorter" (or your chosen name).
    * **User support email:** Your email address.
    * **Developer contact information:** Your email address.
4.  **Scopes:** Click **Add or Remove Scopes**. Find and add the following two **restricted** scopes. You will see warnings, which is expected for a development app.
    * `https://www.googleapis.com/auth/gmail.readonly` - To read email content.
    * `https://www.googleapis.com/auth/gmail.modify` - To archive and delete emails.
5.  **Test Users:**
    * This is a **critical step**. While your app is in "Testing" mode, only listed users can log in.
    * Click **Add Users** and enter the Gmail address provided by the client for testing, as well as your own for development.

### Step 3: Create OAuth 2.0 Credentials

These are the `Client ID` and `Client Secret` your app will use.

1.  Navigate to **APIs & Services > Credentials**.
2.  Click **Create Credentials > OAuth client ID**.
3.  **Application type:** Select **Web application**.
4.  **Authorized JavaScript origins:** These are the domains from which your app can make requests.
    * `http://localhost:3000` (for local development)
5.  **Authorized redirect URIs:** These are the endpoints where Google will send the response after a user authenticates. For NextAuth.js, this is:
    * `http://localhost:3000/api/auth/callback/google`
6.  Click **Create**. You will be shown your **Client ID** and **Client Secret**. Copy these immediately and add them to your `.env.local` file.

```bash
# .env.local
GOOGLE_CLIENT_ID="YOUR_CLIENT_ID_HERE"
GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"
```

## 2. Real-time Email Notifications (Webhook)

To process emails as they arrive, you'll use Gmail's push notifications, which are powered by Google Cloud Pub/Sub.

### Step 1: Create a Pub/Sub Topic

1. In the GCP Console, navigate to **Pub/Sub > Topics**.
2. Click **Create Topic**.
3. Give it a Topic ID (e.g., `gmail-inbox-changes`). Ensure "Add a default subscription" is unchecked.
4. Click **Create**.

### Step 2: Grant Gmail Permission to Publish

Gmail needs permission to send messages to the topic you just created.

1. On your new topic's page, go to the **Permissions** tab.
2. Click **Add Principal**.
3. In the **New principals** field, paste this exact service account name: `gmail-api-push@system.gserviceaccount.com`
4. In the **Select a role** dropdown, choose **Pub/Sub Publisher**.
5. Click **Save**.

### Step 3: Create a Pub/Sub Subscription

This subscription will deliver messages from the topic to your application's API endpoint.

1.  Navigate to **Pub/Sub > Subscriptions**.
2.  Click **Create Subscription**.
3.  Give it a Subscription ID (e.g., `gmail-inbox-processor`).
4.  Select the Pub/Sub topic you created (`gmail-inbox-changes`).
5.  **Delivery type:** Set to **Push**.
6.  **Endpoint URL:** This is the URL of the API route in your Next.js app that will handle the incoming notifications. For Vercel, this will be your production URL: `https://YOUR_APP_URL.vercel.app/api/gmail/webhook` *(used ngrok for now)*
7.  Leave the other settings as default and click **Create**.

### Step 4: Implement the watch() Request

After a user successfully authenticates, you need to tell Gmail to start sending notifications for that user's inbox to your Pub/Sub topic.

This is done by making a `watch` request to the Gmail API.

You only need to do this **once** for each user when they first connect their account. The `watch` request lasts for 7 days, so you should also implement a mechanism to refresh it weekly (e.g., a scheduled job).

```typescript
// Example of a watch request function
// This should be called after a user logs in and you have their access token.

import { google } from 'googleapis';

async function startWatchingUserInbox(accessToken: string, googleProjectTopicName: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        // Only watch for new, unread emails in the inbox
        labelIds: ['INBOX', 'UNREAD'],
        topicName: googleProjectTopicName, // e.g., 'projects/ai-email-sorter/topics/gmail-inbox-changes'
      },
    });
    console.log('Watch request successful:', response.data);
    // Store response.data.historyId and response.data.expiration in your database for the user
    return response.data;
  } catch (error) {
    console.error('Failed to set up watch on user inbox:', error);
  }
}
```

## 3. API Routes & Email Processing Logic

### The Webhook Handler (`/api/gmail/webhook`)

This route receives notifications from Pub/Sub and delegates the heavy lifting to a background job queue.

```typescript
// pages/api/gmail/webhook.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { qstashClient } from '@/lib/qstash'; // Your Upstash QStash client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 1. Decode the Pub/Sub message
    const message = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString('utf-8'));
    const { emailAddress, historyId } = message;

    // 2. Add a job to the queue for processing
    // We send this to another API route that will act as our worker.
    await qstashClient.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/process-email`,
      body: { emailAddress, historyId },
    });

    // 3. Immediately acknowledge the request
    res.status(204).send('');
  } catch (error) {
    console.error('Error in webhook handler:', error);
    res.status(500).send('Internal Server Error');
  }
}
```

### The Email Processor (`/api/gmail/process-email`)

This route is your background worker. It's called by QStash, not directly by the user or Google.

```typescript
// pages/api/gmail/process-email.ts
// ... imports for NextApiRequest, NextApiResponse, googleapis, your Prisma client, etc.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Get user and historyId from the job body
  const { emailAddress, historyId } = req.body;

  // 2. Get the user's refreshed access token from the database
  //    (Your NextAuth.js setup should handle token refreshing)

  // 3. Use the Gmail API's history.list method to find new message IDs since the last historyId

  // 4. For each new message ID, fetch the full message content
  //    const message = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });

  // 5. Parse the message payload to get the body, subject, from, etc.
  //    The content is often base64 encoded and might be in parts (plaintext, html).

  // 6. Send the content to Gemini 2.5 Pro for categorization and summarization.

  // 7. Save the results (category, summary, original content) to your database.

  // 8. Archive the email in Gmail
  // await gmail.users.messages.modify({
  //   userId: 'me',
  //   id: messageId,
  //   requestBody: {
  //     removeLabelIds: ['INBOX', 'UNREAD'], // Moves it out of the inbox
  //   },
  // });

  res.status(200).send('Processing complete.');
}
```

### Bulk Actions (`/api/emails/bulk-action`)

This API route will handle deleting selected emails.

```typescript
// pages/api/emails/bulk-action.ts
// ... imports

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action, emailIds } = req.body; // action can be 'delete'
  // ... get user session and access token

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  if (action === 'delete') {
    // Use batchModify to move multiple emails to the trash
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: emailIds, // array of Gmail message IDs
        addLabelIds: ['TRASH'], // Add to trash
        removeLabelIds: ['INBOX'], // Remove from inbox
      },
    });
  }

  // Handle 'unsubscribe' action by creating jobs for the Unsubscribe Agent

  res.status(200).json({ success: true });
}
```
