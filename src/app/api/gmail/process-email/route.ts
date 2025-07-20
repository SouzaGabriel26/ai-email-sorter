import { responses } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { EmailProcessingJobData } from "@/lib/qstash";
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
): Promise<{ processed: boolean; archived: boolean }> {
  // Check for duplicates first
  const existingEmail = await prisma.email.findUnique({
    where: { gmailId: messageId },
  });

  if (existingEmail) {
    logger.debug("Skipping duplicate message", { messageId });
    return { processed: false, archived: false };
  }

  try {
    const emailContent = await gmailService.getEmailContent(
      clientOptions,
      messageId
    );

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
        aiSummary: null,
        categoryId: null,
      },
    });

    // Archive the email in Gmail after successful database storage
    const archived = await gmailService.archiveEmail(clientOptions, messageId);

    if (archived) {
      // Update the database to reflect archive status
      await prisma.email.update({
        where: { gmailId: messageId },
        data: { isArchived: true },
      });

      logger.info("Email processed and archived successfully", {
        messageId,
        subject: emailContent.subject,
        fromEmail: emailContent.fromEmail,
      });
    } else {
      // Email was stored but archiving failed - this is still a partial success
      logger.warn("Email stored but archiving failed", {
        messageId,
        subject: emailContent.subject,
        fromEmail: emailContent.fromEmail,
      });
    }

    return { processed: true, archived };
  } catch (error) {
    logger.error("Error processing email", { messageId });
    return { processed: false, archived: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as EmailProcessingJobData;

    logger.debug("Processing email job", {
      emailAddress: data.emailAddress,
      historyId: data.historyId,
      userId: data.userId,
      accountId: data.accountId,
    });

    // Validate request and get watch
    const gmailWatch = await validateRequest(data);

    // Prepare Gmail client options
    const clientOptions = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      accountId: data.accountId,
    };

    // Test Gmail connection if no messages found later
    const testConnection = async () => {
      logger.debug("Testing Gmail API access");
      const isConnected = await gmailService.testConnection(clientOptions);
      logger.info("Gmail API test result", { connected: isConnected });
    };

    // Find new messages
    const searchResult = await gmailService.findNewMessages(
      clientOptions,
      gmailWatch.historyId,
      data.historyId
    );

    const { messageIds, source } = searchResult;
    logger.info("Found messages to process", {
      count: messageIds.size,
      source,
    });

    // If no messages found, test the connection
    if (messageIds.size === 0) {
      await testConnection();
    }

    // Process each message
    const stats: ProcessingStats = {
      processed: 0,
      duplicates: 0,
      archived: 0,
      messages: Array.from(messageIds),
    };

    for (const messageId of messageIds) {
      const { processed, archived } = await processEmail(
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
      } else {
        stats.duplicates++;
      }
    }

    logger.info("Processing completed", {
      processed: stats.processed,
      duplicates: stats.duplicates,
      archived: stats.archived,
      total: messageIds.size,
    });

    // Update history ID if we processed any messages
    if (messageIds.size > 0) {
      await prisma.gmailWatch.update({
        where: { id: gmailWatch.id },
        data: { historyId: String(data.historyId) },
      });

      logger.debug("Updated historyId", {
        from: gmailWatch.historyId,
        to: data.historyId,
      });
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

    logger.error("Email processing worker error");
    return responses.internalError("Email processing failed");
  }
}
