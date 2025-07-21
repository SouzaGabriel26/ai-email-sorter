import { google } from "googleapis";
import { logger } from "./logger";
import { prisma } from "./prisma";

export interface GmailWatchResult {
  success: boolean;
  message?: string;
  error?: string;
  accountEmail?: string;
  status?: "started" | "already_active" | "cleaned_and_started";
  expiresAt?: Date;
}

/**
 * Clean up expired watches for all users
 * This should be called periodically (e.g., daily cron job)
 */
export async function cleanupExpiredWatches(): Promise<{
  cleaned: number;
  errors: number;
}> {
  let cleaned = 0;
  let errors = 0;

  try {
    // Find all expired watches
    const expiredWatches = await prisma.gmailWatch.findMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // Expired
          { isActive: false }, // Manually deactivated
        ],
      },
    });

    logger.info("Cleaning up expired Gmail watches", {
      count: expiredWatches.length,
    });

    // Update expired watches to inactive
    if (expiredWatches.length > 0) {
      const result = await prisma.gmailWatch.updateMany({
        where: {
          id: { in: expiredWatches.map((w) => w.id) },
        },
        data: { isActive: false },
      });

      cleaned = result.count;
      logger.info("Cleaned up expired watches", { cleaned });
    }
  } catch (error) {
    logger.error("Error cleaning up expired watches", {
      error: error instanceof Error ? error.message : String(error),
    });
    errors++;
  }

  return { cleaned, errors };
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

    // Enhanced check: Look for any existing watch (active or expired)
    const existingWatch = await prisma.gmailWatch.findFirst({
      where: {
        userId,
        accountEmail: emailAddress,
      },
      orderBy: { createdAt: "desc" }, // Get the most recent
    });

    // If we have an active, non-expired watch, don't create another
    if (existingWatch?.isActive && existingWatch.expiresAt > new Date()) {
      logger.debug("Watch already active for user", {
        userId,
        emailAddress,
        expiresAt: existingWatch.expiresAt.toISOString(),
      });

      return {
        success: true,
        message: "Watch already active",
        accountEmail: emailAddress,
        status: "already_active",
        expiresAt: existingWatch.expiresAt,
      };
    }

    // Clean up any existing watches for this user/email before creating new one
    if (existingWatch) {
      await prisma.gmailWatch.updateMany({
        where: {
          userId,
          accountEmail: emailAddress,
        },
        data: { isActive: false },
      });

      logger.info("Cleaned up existing watch before creating new one", {
        userId,
        emailAddress,
        previousWatchId: existingWatch.id,
      });
    }

    const topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-inbox-changes-ai-email-sorter`;

    logger.debug("Setting up Gmail watch for INBOX and SPAM", {
      userId,
      emailAddress,
      topicName,
    });

    const watchResponse = await gmail.users.watch({
      userId: "me",
      requestBody: {
        labelIds: ["INBOX", "SPAM"],
        topicName,
      },
    });

    if (!watchResponse.data.historyId || !watchResponse.data.expiration) {
      throw new Error("Invalid response from Gmail API");
    }

    const expiresAt = new Date(parseInt(watchResponse.data.expiration));
    const historyId = watchResponse.data.historyId;

    logger.info("Gmail watch API response", {
      historyId,
      expiresAt: expiresAt.toISOString(),
      emailAddress,
    });

    const data = {
      userId,
      accountEmail: emailAddress,
      historyId,
      topicName,
      expiresAt,
      isActive: true,
    };

    // Use upsert to handle any race conditions
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

    const status = existingWatch ? "cleaned_and_started" : "started";

    logger.info("Gmail watch setup completed", {
      userId,
      emailAddress,
      status,
      historyId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      success: true,
      message: `Watch set up for ${emailAddress}`,
      accountEmail: emailAddress,
      status,
      expiresAt,
    };
  } catch (error) {
    logger.error("Error setting up Gmail watch", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
