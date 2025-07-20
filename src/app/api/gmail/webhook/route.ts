import { responses } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { publishEmailProcessingJob } from "@/lib/qstash";
import { gmailService } from "@/services/gmail.service";
import { NextRequest } from "next/server";

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

// Temporary circuit breaker to prevent endless loops during debugging
const recentRequests = new Map<string, number>();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(emailAddress: string): boolean {
  const now = Date.now();
  const key = `${emailAddress}-${Math.floor(now / 60000)}`; // Per minute bucket

  const count = recentRequests.get(key) || 0;
  if (count >= MAX_REQUESTS_PER_MINUTE) {
    logger.warn("Rate limit exceeded for email address", {
      emailAddress,
      count,
      windowStart: Math.floor(now / 60000),
    });
    return false;
  }

  recentRequests.set(key, count + 1);

  // Clean up old entries
  for (const [k, _] of recentRequests) {
    const keyTime = parseInt(k.split("-").pop() || "0");
    if (now - keyTime * 60000 > 120000) {
      // Remove entries older than 2 minutes
      recentRequests.delete(k);
    }
  }

  return true;
}

async function findMatchingAccount(emailAddress: string) {
  const gmailWatch = await prisma.gmailWatch.findFirst({
    where: {
      accountEmail: emailAddress,
      isActive: true,
    },
    include: {
      user: {
        include: {
          accounts: {
            where: { provider: "google" },
            select: {
              id: true,
              access_token: true,
              refresh_token: true,
              expires_at: true,
            },
          },
        },
      },
    },
  });

  if (!gmailWatch?.user?.accounts[0]?.access_token) {
    logger.warn("No active watch or account found", { emailAddress });
    return null;
  }

  const user = gmailWatch.user;

  logger.debug("Looking for OAuth account matching email", {
    emailAddress,
    accountCount: user.accounts.length,
  });

  // Find the correct OAuth account for this Gmail email address
  for (const account of user.accounts) {
    if (!account.access_token) {
      logger.debug("Skipping account - no access token", {
        accountId: account.id,
      });
      continue;
    }

    try {
      const profileEmail = await gmailService.getProfile({
        accessToken: account.access_token,
        refreshToken: account.refresh_token || undefined,
        expiresAt: account.expires_at || undefined,
        accountId: account.id,
      });

      if (profileEmail === emailAddress) {
        logger.info("Found matching account", {
          accountId: account.id,
          emailAddress,
        });
        return { user, account };
      } else {
        logger.debug("Account email doesn't match", {
          accountId: account.id,
          profileEmail,
          targetEmail: emailAddress,
        });
      }
    } catch (error) {
      logger.warn("Failed to test account", { accountId: account.id });
    }
  }

  logger.warn("No matching OAuth account found", { emailAddress });
  return null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Add explicit method check for safety
  if (request.method !== "POST") {
    logger.warn("Webhook received non-POST request", {
      method: request.method,
    });
    return responses.methodNotAllowed();
  }

  try {
    // Step 1: Parse the Pub/Sub message
    const body = (await request.json()) as PubSubMessage;

    logger.debug("Webhook request received", {
      messageId: body.message?.messageId,
      publishTime: body.message?.publishTime,
      subscription: body.subscription,
    });

    if (!body.message?.data) {
      logger.debug("Received empty Pub/Sub message");
      return responses.success();
    }

    // Step 2: Decode and validate the Gmail notification
    const decodedData = Buffer.from(body.message.data, "base64").toString(
      "utf-8"
    );

    let gmailNotification: GmailNotification;
    try {
      gmailNotification = JSON.parse(decodedData);
    } catch (parseError) {
      logger.warn("Failed to parse Gmail notification data", {
        data: decodedData,
      });
      return responses.success(); // Still acknowledge to prevent retries
    }

    if (!gmailNotification.emailAddress || !gmailNotification.historyId) {
      logger.warn("Invalid Gmail notification structure", {
        hasEmail: !!gmailNotification.emailAddress,
        hasHistoryId: !!gmailNotification.historyId,
      });
      return responses.success(); // Acknowledge invalid notifications
    }

    logger.info("Processing Gmail notification", {
      emailAddress: gmailNotification.emailAddress,
      historyId: gmailNotification.historyId,
      messageId: body.message.messageId,
    });

    // Step 3: Rate limit check to prevent endless loops
    if (!checkRateLimit(gmailNotification.emailAddress)) {
      logger.error("Rate limit exceeded - possible endless loop detected", {
        emailAddress: gmailNotification.emailAddress,
        historyId: gmailNotification.historyId,
      });
      return responses.success(); // Still acknowledge to prevent further retries
    }

    // Step 4: Find matching account
    const matchResult = await findMatchingAccount(
      gmailNotification.emailAddress
    );
    if (!matchResult) {
      logger.info("No matching account found, acknowledging notification", {
        emailAddress: gmailNotification.emailAddress,
      });
      return responses.success(); // Acknowledge even if no match found
    }

    const { user, account } = matchResult;

    // Step 5: Check for duplicate notifications (same historyId already processed)
    const existingWatch = await prisma.gmailWatch.findFirst({
      where: {
        userId: user.id,
        accountEmail: gmailNotification.emailAddress,
        isActive: true,
      },
    });

    if (
      existingWatch &&
      existingWatch.historyId === gmailNotification.historyId
    ) {
      logger.info("Duplicate notification for already processed historyId", {
        emailAddress: gmailNotification.emailAddress,
        historyId: gmailNotification.historyId,
        messageId: body.message.messageId,
      });
      return responses.success(); // Acknowledge duplicate to stop retries
    }

    // Step 6: Publish background job
    try {
      await publishEmailProcessingJob({
        emailAddress: gmailNotification.emailAddress,
        historyId: gmailNotification.historyId,
        userId: user.id,
        accountId: account.id,
        accessToken: account.access_token!,
        refreshToken: account.refresh_token || undefined,
        expiresAt: account.expires_at || undefined,
      });

      logger.info("Email processing job queued successfully", {
        emailAddress: gmailNotification.emailAddress,
        userId: user.id,
        accountId: account.id,
        messageId: body.message.messageId,
      });
    } catch (qstashError) {
      // Even if QStash fails, we should acknowledge the webhook to prevent infinite retries
      // The email processing will be lost, but we log it for manual intervention
      logger.error("Critical: Failed to queue email processing job", {
        emailAddress: gmailNotification.emailAddress,
        userId: user.id,
        accountId: account.id,
        messageId: body.message.messageId,
        error:
          qstashError instanceof Error
            ? qstashError.message
            : String(qstashError),
      });
    }

    // Always acknowledge the webhook to prevent retries
    return responses.success();
  } catch (error) {
    // Log the error but still acknowledge to prevent infinite retries
    logger.error("Webhook processing error", {
      error: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime,
    });
    return responses.success();
  } finally {
    logger.debug("Webhook request completed", {
      processingTime: Date.now() - startTime,
    });
  }
}

export async function GET() {
  return responses.success({
    message: "Gmail webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
