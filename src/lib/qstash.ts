import { Client } from "@upstash/qstash";

if (!process.env.QSTASH_TOKEN) {
  throw new Error("QSTASH_TOKEN environment variable is required");
}

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
});

export interface EmailProcessingJobData {
  emailAddress: string;
  historyId: string;
  userId: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Create deterministic job ID for deduplication
function createJobId(emailAddress: string, historyId: string): string {
  return `email-${emailAddress.replace("@", "-at-")}-${historyId}`;
}

export async function publishEmailProcessingJob(data: EmailProcessingJobData) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL environment variable is required");
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/process-email`;

  // Create unique job ID for deduplication
  const jobId = createJobId(data.emailAddress, data.historyId);

  return await qstashClient.publishJSON({
    url,
    body: data,
    retries: 2, // Reduced from 3 to 2
    delay: 5, // Increased delay to reduce rapid retries
    deduplicationId: jobId, // Prevent duplicate jobs for same email/historyId
    headers: {
      "QStash-Deduplication-Id": jobId,
    },
  });
}
