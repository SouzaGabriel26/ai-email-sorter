import { responses } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { publishEmailProcessingJob } from "@/lib/qstash";
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

// Enhanced rate limiting and deduplication
const recentRequests = new Map<string, number>();
const processedNotifications = new Map<string, number>(); // Track processed historyIds
const MAX_REQUESTS_PER_MINUTE = 8; // Reduced from 10
const NOTIFICATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  // Clean up old entries every request
  for (const [k, _] of recentRequests) {
    const keyTime = parseInt(k.split("-").pop() || "0");
    if (now - keyTime * 60000 > 120000) {
      recentRequests.delete(k);
    }
  }

  return true;
}

function checkNotificationDeduplication(
  emailAddress: string,
  historyId: string
): boolean {
  const key = `${emailAddress}-${historyId}`;
  const now = Date.now();

  // Check if we've already processed this notification recently
  const lastProcessed = processedNotifications.get(key);
  if (lastProcessed && now - lastProcessed < NOTIFICATION_CACHE_TTL) {
    logger.info("Skipping recently processed notification", {
      emailAddress,
      historyId,
      lastProcessedAgo: now - lastProcessed,
    });
    return false;
  }

  // Mark as processed
  processedNotifications.set(key, now);

  // Clean up old entries
  for (const [k, timestamp] of processedNotifications) {
    if (now - timestamp > NOTIFICATION_CACHE_TTL * 2) {
      processedNotifications.delete(k);
    }
  }

  return true;
}

// Optimized account matching with caching
interface CachedAccountMatch {
  data: {
    user: {
      id: string;
      accounts: Array<{
        id: string;
        access_token: string | null;
        refresh_token: string | null;
        expires_at: number | null;
      }>;
    };
    account: {
      id: string;
      access_token: string | null;
      refresh_token: string | null;
      expires_at: number | null;
    };
  } | null;
  timestamp: number;
}

const accountCache = new Map<string, CachedAccountMatch>();
const ACCOUNT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function findMatchingAccount(emailAddress: string) {
  const cacheKey = emailAddress;
  const cached = accountCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < ACCOUNT_CACHE_TTL) {
    return cached.data;
  }

  // Find the watch and associated user/account
  const gmailWatch = await prisma.gmailWatch.findFirst({
    where: {
      accountEmail: emailAddress,
      isActive: true,
      expiresAt: { gt: new Date() }, // Only active, non-expired watches
    },
    include: {
      user: {
        include: {
          accounts: {
            where: {
              provider: "google",
              access_token: { not: null }, // Only accounts with valid tokens
            },
            select: {
              id: true,
              providerAccountId: true,
              access_token: true,
              refresh_token: true,
              expires_at: true,
            },
          },
        },
      },
    },
  });

  if (!gmailWatch?.user?.accounts[0]) {
    logger.warn("No active watch or account found", { emailAddress });

    // Cache negative result for short time to avoid repeated queries
    accountCache.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
    });

    return null;
  }

  // **CRITICAL FIX**: Find the specific account that matches the emailAddress
  // We need to check each account's actual Gmail address using the Gmail API
  let matchingAccount = null;

  for (const account of gmailWatch.user.accounts) {
    try {
      // Create OAuth2 client for this account
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      // Get the Gmail profile to find the actual email address
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const accountEmail = profile.data.emailAddress;

      if (accountEmail === emailAddress) {
        matchingAccount = account;
        logger.info("Found matching account", {
          accountId: account.id,
          accountEmail,
          targetEmail: emailAddress,
        });
        break;
      }
    } catch (error) {
      logger.warn("Failed to check account email", {
        accountId: account.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue checking other accounts
    }
  }

  if (!matchingAccount) {
    logger.warn("No matching account found for email address", {
      emailAddress,
      availableAccounts: gmailWatch.user.accounts.map((a) => a.id).join(", "),
    });

    // Cache negative result
    accountCache.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
    });

    return null;
  }

  const result = {
    user: gmailWatch.user,
    account: matchingAccount, // Use the specific matching account
  };

  // Cache positive result
  accountCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
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

    if (!body.message?.data) {
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

    // Step 3: Enhanced deduplication checks
    if (
      !checkNotificationDeduplication(
        gmailNotification.emailAddress,
        gmailNotification.historyId
      )
    ) {
      return responses.success(); // Already processed recently
    }

    if (!checkRateLimit(gmailNotification.emailAddress)) {
      logger.error("Rate limit exceeded - possible endless loop detected", {
        emailAddress: gmailNotification.emailAddress,
        historyId: gmailNotification.historyId,
      });
      return responses.success(); // Still acknowledge to prevent further retries
    }

    // Step 4: Find matching account (optimized with caching)
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

    // Step 5: Check database for duplicate historyId processing
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

    // Step 6: Publish background job with deduplication
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
        processingTime: Date.now() - startTime,
      });
    } catch (qstashError) {
      // Even if QStash fails, we should acknowledge the webhook to prevent infinite retries
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
  }
}

// Health check endpoint
export async function GET() {
  return responses.success({
    status: "active",
    timestamp: new Date().toISOString(),
    cacheStats: {
      accountCacheSize: accountCache.size,
      processedNotificationsSize: processedNotifications.size,
      recentRequestsSize: recentRequests.size,
    },
  });
}
