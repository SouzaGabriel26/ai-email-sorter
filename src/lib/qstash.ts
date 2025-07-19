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

export async function publishEmailProcessingJob(data: EmailProcessingJobData) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL environment variable is required");
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/process-email`;

  return await qstashClient.publishJSON({
    url,
    body: data,
    retries: 3,
    delay: 2,
  });
}
