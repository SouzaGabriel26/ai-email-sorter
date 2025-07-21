import { responses } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { EmailProcessingJobData } from "@/lib/qstash";
import { aiService } from "@/services/ai.service";
import {
  gmailService,
  type GmailClientOptions,
} from "@/services/gmail.service";
import type { EmailProcessingResult } from "@/types/api";
import { NextRequest } from "next/server";

interface ProcessingStats {
  processed: number;
  duplicates: number;
  archived: number;
  categorized: number;
  summarized: number;
  messages: string[];
}

async function validateRequest(data: EmailProcessingJobData) {
  const { emailAddress, historyId, userId, accountId, accessToken } = data;

  if (!emailAddress || !historyId || !userId || !accountId || !accessToken) {
    throw new Error("Invalid request body");
  }

  const gmailWatch = await prisma.gmailWatch.findFirst({
    where: {
      userId,
      accountEmail: emailAddress,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
  });

  if (!gmailWatch) {
    throw new Error("No active watch found");
  }

  return gmailWatch;
}

async function processEmail(
  messageId: string,
  userId: string,
  emailAddress: string,
  clientOptions: GmailClientOptions
): Promise<{
  processed: boolean;
  archived: boolean;
  categorized: boolean;
  summarized: boolean;
}> {
  // Input validation
  if (!messageId || !userId || !emailAddress) {
    logger.error("Invalid input parameters for email processing", {
      messageId: !!messageId,
      userId: !!userId,
      emailAddress: !!emailAddress,
    });
    return {
      processed: false,
      archived: false,
      categorized: false,
      summarized: false,
    };
  }

  // Check for duplicates first - more comprehensive check
  const existingEmail = await prisma.email.findUnique({
    where: { gmailId: messageId },
    select: {
      id: true,
      processedAt: true,
      subject: true,
      userId: true,
    },
  });

  if (existingEmail) {
    // Extra validation: ensure it's not a cross-user duplicate and was actually processed
    if (existingEmail.userId === userId && existingEmail.processedAt) {
      logger.debug("Skipping duplicate message - already processed", {
        messageId,
        existingEmailId: existingEmail.id,
        processedAt: existingEmail.processedAt?.toISOString() || null,
        subject: existingEmail.subject,
      });
      return {
        processed: false,
        archived: false,
        categorized: false,
        summarized: false,
      };
    } else if (existingEmail.userId !== userId) {
      logger.warn("Gmail message ID collision between users", {
        messageId,
        currentUserId: userId,
        existingUserId: existingEmail.userId,
      });
      // Continue processing as this might be a legitimate different email
    } else {
      logger.warn(
        "Found unprocessed email with same Gmail ID - will reprocess",
        {
          messageId,
          existingEmailId: existingEmail.id,
          processedAt: existingEmail.processedAt?.toISOString() || null,
        }
      );
      // Continue processing as the previous attempt might have failed
    }
  }

  try {
    // **NEW: Check if email is in SPAM and move to INBOX before processing**
    const isInSpam = await gmailService.checkIfEmailInSpam(
      clientOptions,
      messageId
    );

    if (isInSpam) {
      logger.info("Email found in SPAM, moving to INBOX before processing", {
        messageId,
        emailAddress,
      });

      const movedToInbox = await gmailService.moveFromSpamToInbox(
        clientOptions,
        messageId
      );

      if (!movedToInbox) {
        logger.warn(
          "Failed to move email from SPAM to INBOX, but continuing processing",
          {
            messageId,
            emailAddress,
          }
        );
      }
    }

    // Step 1: Fetch email content from Gmail
    const emailContent = await gmailService.getEmailContent(
      clientOptions,
      messageId
    );

    logger.info("Processing email", {
      messageId,
      subject: emailContent.subject,
      fromEmail: emailContent.fromEmail,
      userId,
      wasInSpam: isInSpam,
    });

    // Step 2: Check if user has categories before AI processing
    const hasCategories = await aiService.validateUserHasCategories(userId);

    let aiResult = null;
    let categorized = false;
    let summarized = false;

    if (hasCategories) {
      // Step 3: AI categorization and summarization
      try {
        aiResult = await aiService.categorizeAndSummarizeEmail(
          {
            subject: emailContent.subject,
            fromEmail: emailContent.fromEmail,
            fromName: emailContent.fromName || undefined,
            bodyText: emailContent.bodyText || undefined,
            bodyHtml: emailContent.bodyHtml || undefined,
          },
          userId
        );

        categorized = aiResult.categoryId !== null;
        summarized = aiResult.summary.length > 0;

        logger.info("AI processing completed", {
          messageId,
          categoryId: aiResult.categoryId,
          categoryName: aiResult.categoryName,
          confidence: aiResult.confidence,
          summarized,
          reasoning: aiResult.reasoning,
        });
      } catch (aiError) {
        logger.error("AI processing failed for email", {
          messageId,
          subject: emailContent.subject,
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });

        // Continue without AI processing - email will still be stored
        aiResult = {
          categoryId: null,
          categoryName: null,
          summary: `Email from ${emailContent.fromEmail} about: ${emailContent.subject}`,
          confidence: 0,
          reasoning: "AI processing failed",
        };
      }
    } else {
      logger.warn("User has no categories - skipping AI processing", {
        userId,
        messageId,
        subject: emailContent.subject,
      });

      // Provide basic summary without categorization
      aiResult = {
        categoryId: null,
        categoryName: null,
        summary: `Email from ${emailContent.fromEmail} about: ${emailContent.subject}`,
        confidence: 0,
        reasoning: "No categories available for classification",
      };
    }

    // Step 4: Store email in database with AI results
    await prisma.email.create({
      data: {
        gmailId: messageId,
        userId,
        accountEmail: emailAddress,
        subject: emailContent.subject,
        fromEmail: emailContent.fromEmail,
        fromName: emailContent.fromName,
        toEmail: emailContent.toEmail,
        bodyText: emailContent.bodyText,
        bodyHtml: emailContent.bodyHtml,
        receivedAt: emailContent.receivedAt,
        processedAt: new Date(),
        aiSummary: aiResult.summary,
        categoryId: aiResult.categoryId,
      },
    });

    // Step 5: Archive the email in Gmail after successful database storage
    const archived = await gmailService.archiveEmail(clientOptions, messageId);

    if (archived) {
      // Update the database to reflect archive status
      await prisma.email.update({
        where: { gmailId: messageId },
        data: { isArchived: true },
      });

      logger.info("Email processed, categorized, and archived successfully", {
        messageId,
        subject: emailContent.subject,
        fromEmail: emailContent.fromEmail,
        categoryId: aiResult.categoryId,
        categoryName: aiResult.categoryName,
        confidence: aiResult.confidence,
        archived: true,
      });
    } else {
      // Email was stored but archiving failed - this is still a partial success
      logger.warn("Email stored and categorized but archiving failed", {
        messageId,
        subject: emailContent.subject,
        fromEmail: emailContent.fromEmail,
        categoryId: aiResult.categoryId,
        archived: false,
      });
    }

    return {
      processed: true,
      archived,
      categorized,
      summarized: true, // We always generate a summary, even if basic
    };
  } catch (error) {
    logger.error("Email processing failed", {
      messageId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      processed: false,
      archived: false,
      categorized: false,
      summarized: false,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as EmailProcessingJobData;

    // Validate request and get watch
    const gmailWatch = await validateRequest(data);

    // Prepare Gmail client options
    const clientOptions = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      accountId: data.accountId,
    };

    // Check if user has categories before processing
    const hasCategories = await aiService.validateUserHasCategories(
      data.userId
    );

    if (!hasCategories) {
      logger.warn(
        "User has no categories - emails will be stored but not categorized",
        {
          userId: data.userId,
          emailAddress: data.emailAddress,
        }
      );
    }

    // Test Gmail connection if no messages found later
    const testConnection = async () => {
      const isConnected = await gmailService.testConnection(clientOptions);
      logger.info("Gmail API test result", { connected: isConnected });
    };

    // **NEW: Use timestamp-based filtering to only process recent emails**
    // Check if this is the first time processing for this watch
    const hasProcessedBefore = gmailWatch.lastProcessedAt !== null;
    let fromTimestamp: number;

    if (!hasProcessedBefore) {
      // For watches that have never processed emails, use a longer lookback to catch recent emails
      // The email might have arrived just before processing started
      fromTimestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago instead of 10
      logger.info("First processing run - processing recent emails only", {
        emailAddress: data.emailAddress,
        fromTimestamp: new Date(fromTimestamp).toISOString(),
        reason: "preventing historical email processing with 30min lookback",
      });
    } else {
      // For existing watches, use last processed time with a buffer
      const lastProcessed = gmailWatch.lastProcessedAt?.getTime() || 0;
      const bufferTime = 5 * 60 * 1000; // 5 minute buffer to catch emails that arrived slightly before
      const recentCutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago max
      fromTimestamp = Math.max(lastProcessed - bufferTime, recentCutoff);

      logger.debug(
        "Continuing watch - using last processed timestamp with buffer",
        {
          emailAddress: data.emailAddress,
          lastProcessedAt: gmailWatch.lastProcessedAt?.toISOString() || null,
          fromTimestamp: new Date(fromTimestamp).toISOString(),
          bufferMinutes: 5,
        }
      );
    }

    // Find new messages with timestamp filtering
    const searchResult = await gmailService.findNewMessages(
      clientOptions,
      gmailWatch.historyId,
      data.historyId,
      fromTimestamp // Pass the timestamp filter
    );

    const { messageIds, source } = searchResult;
    logger.info("Found messages to process with timestamp filtering", {
      count: messageIds.size,
      source,
      hasCategories,
      fromTimestamp: new Date(fromTimestamp).toISOString(),
      isFirstRun: !hasProcessedBefore,
    });

    // If no messages found, test the connection
    if (messageIds.size === 0) {
      await testConnection();
    }

    // Process each message with AI categorization
    const stats: ProcessingStats = {
      processed: 0,
      duplicates: 0,
      archived: 0,
      categorized: 0,
      summarized: 0,
      messages: Array.from(messageIds),
    };

    for (const messageId of messageIds) {
      const { processed, archived, categorized, summarized } =
        await processEmail(
          messageId,
          data.userId,
          data.emailAddress,
          clientOptions
        );

      if (processed) {
        stats.processed++;
        if (archived) {
          stats.archived++;
        }
        if (categorized) {
          stats.categorized++;
        }
        if (summarized) {
          stats.summarized++;
        }
      } else {
        stats.duplicates++;
      }
    }

    logger.info("Email processing completed with AI categorization", {
      processed: stats.processed,
      duplicates: stats.duplicates,
      archived: stats.archived,
      categorized: stats.categorized,
      summarized: stats.summarized,
      total: messageIds.size,
      hasCategories,
      categorizationRate:
        stats.processed > 0
          ? ((stats.categorized / stats.processed) * 100).toFixed(1) + "%"
          : "0%",
    });

    // Update history ID and last processed timestamp
    if (stats.processed > 0) {
      await prisma.gmailWatch.update({
        where: { id: gmailWatch.id },
        data: {
          historyId: String(data.historyId),
          lastProcessedAt: new Date(), // Track when we last processed emails
        },
      });

      logger.info(
        "Updated historyId and lastProcessedAt after processing emails",
        {
          previousHistoryId: gmailWatch.historyId,
          newHistoryId: data.historyId,
          emailsProcessed: stats.processed,
          lastProcessedAt: new Date().toISOString(),
        }
      );
    } else {
      // Only update historyId, don't update lastProcessedAt when no emails processed
      // This prevents the time window from becoming too narrow
      await prisma.gmailWatch.update({
        where: { id: gmailWatch.id },
        data: {
          historyId: String(data.historyId),
          // Don't update lastProcessedAt - keep the previous value
        },
      });

      logger.debug(
        "Updated historyId only (no emails processed, keeping previous lastProcessedAt)",
        {
          previousHistoryId: gmailWatch.historyId,
          newHistoryId: data.historyId,
          previousLastProcessedAt:
            gmailWatch.lastProcessedAt?.toISOString() || null,
        }
      );
    }

    const result: EmailProcessingResult = {
      processed: stats.processed,
      duplicates: stats.duplicates,
      archived: stats.archived,
      messages: stats.messages,
    };

    return responses.success(result);
  } catch (error) {
    if (error instanceof Error && error.message === "No active watch found") {
      return responses.notFound("No active watch");
    }

    if (error instanceof Error && error.message === "Invalid request body") {
      return responses.badRequest("Invalid request body");
    }

    logger.error("Email processing worker error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return responses.internalError("Email processing failed");
  }
}
