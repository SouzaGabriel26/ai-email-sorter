import { google } from "googleapis";
import { prisma } from "./prisma";

export interface GmailWatchResult {
  success: boolean;
  message?: string;
  error?: string;
  accountEmail?: string;
  status?: "started" | "already_active";
  expiresAt?: Date;
}

export async function setupGmailWatchForUser(
  userId: string,
  accessToken: string,
  refreshToken?: string
): Promise<GmailWatchResult> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress!;

    const existingWatch = await prisma.gmailWatch.findFirst({
      where: {
        userId,
        accountEmail: emailAddress,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingWatch) {
      return {
        success: true,
        message: "Watch already active",
        accountEmail: emailAddress,
        status: "already_active",
        expiresAt: existingWatch.expiresAt,
      };
    }

    const topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-inbox-changes-ai-email-sorter`;

    const watchResponse = await gmail.users.watch({
      userId: "me",
      requestBody: {
        labelIds: ["INBOX"],
        topicName,
      },
    });

    if (!watchResponse.data.historyId || !watchResponse.data.expiration) {
      throw new Error("Invalid response from Gmail API");
    }

    const expiresAt = new Date(parseInt(watchResponse.data.expiration));

    const data = {
      userId,
      accountEmail: emailAddress,
      historyId: watchResponse.data.historyId,
      topicName,
      expiresAt,
      isActive: true,
    };

    await prisma.gmailWatch.upsert({
      where: {
        userId_accountEmail: {
          userId,
          accountEmail: emailAddress,
        },
      },
      update: data,
      create: data,
    });

    return {
      success: true,
      message: `Watch set up for ${emailAddress}`,
      accountEmail: emailAddress,
      status: "started",
      expiresAt,
    };
  } catch (error) {
    console.error("Error setting up Gmail watch:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
