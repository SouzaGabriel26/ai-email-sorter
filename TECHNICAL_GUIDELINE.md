# Contract App - AI Email Sorter (July 2025 Challenge)

This document outlines the plan, rules, and technical specifications for building the AI Email Sorting application. This will serve as the primary context for AI-assisted development using Cursor.

## 1. Challenge Overview & Rules

-   **Project:** An AI-powered application that sorts a user's Gmail emails into custom categories, summarizes them, and provides bulk actions.
-   **Timeline:** 72 hours.
-   **Deadline:** Monday, July 21, @ 7am MT (Denver).
-   **Reward:** $3,000 upon successful completion and submission.
-   **Primary Constraint:** Must be built by a single developer. **No outside human help is permitted.** Extensive use of AI (Cursor Pro) is encouraged and expected.
-   **Submission Requirements:**
    1.  A fully deployed, working application URL (Vercel is the target).
    2.  A link to the public GitHub repository.
    3.  The client's Gmail address must be added as a "Test User" in the Google Cloud OAuth Consent Screen to allow for testing.

---

## 2. Core Application Requirements

### **Authentication & Accounts**

-   [ ] **Sign in with Google:** Users must be able to authenticate using their Google account via OAuth.
-   [ ] **Request Gmail Scopes:** The OAuth flow must request `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.modify` scopes.
-   [ ] **Connect Multiple Gmail Accounts:** Users should be able to connect more than one Gmail account and have the app process emails from all connected inboxes.

### **Category Management**

-   [ ] **List Categories:** Display a list of the user's custom-defined categories.
-   [ ] **Add New Category:** A button/form to create a new category with a `name` and `description`. The description is crucial as it will be used by the AI to classify emails.

### **Email Processing (The AI Core)**

-   [ ] **Import New Emails:** When a new email arrives in a connected Gmail account, it must be imported into the application.
-   [ ] **AI Categorization:** Use an AI model to analyze the email's content and sort it into one of the user's custom categories based on the category's `description`.
-   [ ] **AI Summarization:** After categorization, generate a concise AI summary of the email.
-   [ ] **Archive in Gmail:** Once the email is successfully imported, categorized, and summarized, it must be **archived** (not deleted) in the user's Gmail account.

### **User Interface & Actions**

-   [ ] **Category View:** When a user clicks on a category, display a list of all emails sorted into it.
-   [ ] **Display Summaries:** Each email in the list should show its AI-generated summary.
-   [ ] **View Original Email:** Clicking on a specific email summary should allow the user to view the full, original email content.
-   [ ] **Bulk Actions:** The user must be able to select multiple (or all) emails in a category.
-   [ ] **Bulk Delete:** A "Delete" action that moves the selected emails to the trash in Gmail.
-   [ ] **AI Unsubscribe Agent:** An "Unsubscribe" action that:
    -   Finds the unsubscribe link within each selected email.
    -   Acts as an AI agent to navigate to the link and complete the unsubscribe process automatically (e.g., filling forms, clicking confirmation buttons).

### **Testing**

-   [ ] The application must have good test coverage. AI-assisted test generation is strongly recommended.

---

## 3. Technology Stack & Architecture

This is the definitive stack to be used for the project.

-   **Framework:** Next.js (App Router)
-   **Styling:** Tailwind CSS
-   **UI Components:** Shadcn
-   **ORM:** Prisma
-   **Database:** PostgreSQL (hosted on **Railway**)
-   **Deployment:** **Vercel**
-   **Authentication:** NextAuth.js (v5 / Auth.js)
-   **AI Model:** **Gemini 1.5 Pro** (via Google AI SDK) for categorization, summarization, and the unsubscribe agent logic.
-   **Asynchronous Processing:** **Upstash QStash** for background job queueing. This is **essential** for handling email processing without serverless function timeouts.
-   **Browser Automation:** **Playwright** for the AI Unsubscribe Agent.
-   **Language:** TypeScript

---

## 4. High-Level Development Plan

### **Phase 1: Foundation (Hours 0-24)**

1.  **Project Init:** Setup Next.js, TypeScript, Tailwind, Prisma, and Shadcn.
2.  **Database & Deployment:** Create the PostgreSQL DB on Railway and connect the GitHub repo to Vercel. Configure environment variables (`DATABASE_URL`).
3.  **Schema:** Define the Prisma schema with `User`, `Account`, `Category`, and `Email` models.
4.  **Authentication:** Implement Google OAuth with NextAuth.js, requesting the correct Gmail scopes. Ensure the Prisma adapter is working correctly.
5.  **Category Management:** Build the UI and API routes for creating and listing categories.

### **Phase 2: AI & Backend Logic (Hours 25-48)**

1.  **Asynchronous Setup:** Configure Upstash QStash. Create two main API routes:
    -   An endpoint that receives the Gmail webhook, creates a job, and pushes it to QStash.
    -   A "worker" endpoint that QStash will call to process the job.
2.  **Email Processing Worker:** Implement the core logic inside the worker:
    -   Use the Gmail API to fetch email content.
    -   Call the Gemini 1.5 Pro API for categorization and summarization.
    -   Save the results to the database via Prisma.
    -   Call the Gmail API to archive the email.
3.  **Gmail Webhook:** Set up the push notifications in Google Cloud to point to your webhook endpoint.
4.  **Frontend Display:** Build the dynamic pages to display emails within categories and the modal/page to view the original content.

### **Phase 3: Advanced Features & Testing (Hours 49-72)**

1.  **Bulk Actions:** Implement the frontend controls for multi-select and the API logic for bulk deleting emails via the Gmail API.
2.  **Unsubscribe Agent:**
    -   Create a new async job type for unsubscribing.
    -   The worker for this job will use Playwright to navigate pages.
    -   Use Gemini 1.5 Pro to analyze the DOM of the unsubscribe page and decide which actions Playwright should take. This is the most experimental part.
3.  **Testing:** Write unit and integration tests for the critical paths: auth, API routes, and the email processing flow. Use AI to accelerate this.
4.  **Final Polish & Deploy:** Refine the UI/UX, test the deployed application end-to-end, and prepare for submission.