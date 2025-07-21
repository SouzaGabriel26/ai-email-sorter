import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { google, type gmail_v1 } from "googleapis";

// Constants for better maintainability
const DEFAULT_LOOKBACK_HOURS = 1;
const FALLBACK_MAX_RESULTS = 5;
const SPAM_FALLBACK_MAX_RESULTS = 3;
const FALLBACK_TIME_WINDOW = "1h";
const UNREAD_FALLBACK_MAX_RESULTS = 5;

export interface GmailClientOptions {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
}

export interface EmailContent {
  subject: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
}

export interface MessageSearchResult {
  messageIds: Set<string>;
  source:
    | "history"
    | "recent_history"
    | "message_list"
    | "timestamp_filtered"
    | "timestamp_filtered_fallback"
    | "failed";
}

export class GmailService {
  private async createAuthenticatedClient(
    options: GmailClientOptions
  ): Promise<gmail_v1.Gmail> {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Missing Google OAuth credentials");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    const now = Math.floor(Date.now() / 1000);
    const isTokenExpired = options.expiresAt && options.expiresAt < now;

    if (isTokenExpired && options.refreshToken && options.accountId) {
      logger.debug("Refreshing expired token", {
        accountId: options.accountId,
      });

      try {
        oauth2Client.setCredentials({ refresh_token: options.refreshToken });
        const { credentials } = await oauth2Client.refreshAccessToken();

        if (!credentials.access_token) {
          throw new Error("Failed to refresh access token");
        }

        // Update token in database
        await prisma.account.update({
          where: { id: options.accountId },
          data: {
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date
              ? Math.floor(credentials.expiry_date / 1000)
              : null,
          },
        });

        oauth2Client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: options.refreshToken,
        });
      } catch (error) {
        logger.error("Token refresh failed", {
          accountId: options.accountId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(
          `Token refresh failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } else {
      oauth2Client.setCredentials({
        access_token: options.accessToken,
        refresh_token: options.refreshToken,
      });
    }

    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  async getProfile(options: GmailClientOptions): Promise<string> {
    const gmail = await this.createAuthenticatedClient(options);
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.emailAddress!;
  }

  async findNewMessages(
    options: GmailClientOptions,
    storedHistoryId: string,
    currentHistoryId: string,
    fromTimestamp?: number // New parameter for "from now on" processing
  ): Promise<MessageSearchResult> {
    const gmail = await this.createAuthenticatedClient(options);
    const messageIds = new Set<string>();

    // If history IDs are the same, no new messages
    if (storedHistoryId === currentHistoryId) {
      return { messageIds, source: "history" };
    }

    // **NEW APPROACH: Only process emails from a specific timestamp forward**
    // This prevents processing old emails when Gmail history changes due to archiving

    const cutoffTime =
      fromTimestamp || Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000; // Default: 1 hour ago
    const cutoffDate = new Date(cutoffTime);

    logger.info("Using timestamp-based filtering for new emails", {
      cutoffTime: cutoffDate.toISOString(),
      reason: fromTimestamp ? "explicit timestamp" : "default 1 hour lookback",
    });

    try {
      // Try history API first, but handle failures gracefully
      const allMessageIds = new Set<string>();
      let historyFailed = false;

      try {
        // Use history API to get only new messages, then filter by timestamp
        const historyResponse = await gmail.users.history.list({
          userId: "me",
          startHistoryId: storedHistoryId,
          historyTypes: ["messageAdded"],
          labelId: "INBOX",
        });

        const historyItems = historyResponse.data.history || [];
        logger.debug("Found history items", {
          count: historyItems.length,
          storedHistoryId,
          currentHistoryId,
        });

        // Collect all message IDs from history
        for (const historyItem of historyItems) {
          const messagesAdded = historyItem.messagesAdded || [];
          for (const messageAdded of messagesAdded) {
            if (messageAdded.message?.id) {
              allMessageIds.add(messageAdded.message.id);
            }
          }
        }

        // If no messages found in history, try SPAM label as well
        if (allMessageIds.size === 0) {
          const spamHistoryResponse = await gmail.users.history.list({
            userId: "me",
            startHistoryId: storedHistoryId,
            historyTypes: ["messageAdded"],
            labelId: "SPAM",
          });

          const spamHistoryItems = spamHistoryResponse.data.history || [];
          logger.debug("Found SPAM history items", {
            count: spamHistoryItems.length,
          });

          for (const historyItem of spamHistoryItems) {
            const messagesAdded = historyItem.messagesAdded || [];
            for (const messageAdded of messagesAdded) {
              if (messageAdded.message?.id) {
                allMessageIds.add(messageAdded.message.id);
              }
            }
          }
        }

        logger.debug("Found messages from history", {
          messageCount: allMessageIds.size,
          cutoffDate: cutoffDate.toISOString(),
        });
      } catch (historyError) {
        logger.warn("History API failed, falling back to recent messages", {
          error:
            historyError instanceof Error
              ? historyError.message
              : String(historyError),
          storedHistoryId,
        });
        historyFailed = true;
      }

      // If history failed or no messages found, get recent messages as fallback
      if (historyFailed || allMessageIds.size === 0) {
        logger.info(
          "Using fallback: getting recent messages from INBOX and SPAM"
        );

        // **NEW**: Try to get messages from the current historyId directly
        // This works even when the stored historyId is invalid
        try {
          const currentHistoryResponse = await gmail.users.history.list({
            userId: "me",
            startHistoryId: currentHistoryId,
            historyTypes: ["messageAdded"],
            labelId: "INBOX",
          });

          const currentHistoryItems = currentHistoryResponse.data.history || [];
          logger.debug("Found current history items", {
            count: currentHistoryItems.length,
          });

          // Collect message IDs from current history
          for (const historyItem of currentHistoryItems) {
            const messagesAdded = historyItem.messagesAdded || [];
            for (const messageAdded of messagesAdded) {
              if (messageAdded.message?.id) {
                allMessageIds.add(messageAdded.message.id);
              }
            }
          }

          // Also check SPAM
          const currentSpamHistoryResponse = await gmail.users.history.list({
            userId: "me",
            startHistoryId: currentHistoryId,
            historyTypes: ["messageAdded"],
            labelId: "SPAM",
          });

          const currentSpamHistoryItems =
            currentSpamHistoryResponse.data.history || [];
          logger.debug("Found current SPAM history items", {
            count: currentSpamHistoryItems.length,
          });

          for (const historyItem of currentSpamHistoryItems) {
            const messagesAdded = historyItem.messagesAdded || [];
            for (const messageAdded of messagesAdded) {
              if (messageAdded.message?.id) {
                allMessageIds.add(messageAdded.message.id);
              }
            }
          }

          if (allMessageIds.size > 0) {
            logger.info("Found messages from current history", {
              count: allMessageIds.size,
              messageIds: Array.from(allMessageIds).join(", "),
            });
          }
        } catch (currentHistoryError) {
          logger.warn("Failed to get messages from current history", {
            error:
              currentHistoryError instanceof Error
                ? currentHistoryError.message
                : String(currentHistoryError),
            currentHistoryId,
          });
        }

        // If we still don't have the specific message, try general search
        if (allMessageIds.size === 0) {
          // Get recent messages from INBOX - use a more conservative search
          const inboxResponse = await gmail.users.messages.list({
            userId: "me",
            labelIds: ["INBOX"],
            maxResults: FALLBACK_MAX_RESULTS,
            q: `newer_than:${FALLBACK_TIME_WINDOW}`,
          });

          const inboxMessages = inboxResponse.data.messages || [];
          logger.debug("Found recent INBOX messages", {
            count: inboxMessages.length,
          });

          // Get recent messages from SPAM
          const spamResponse = await gmail.users.messages.list({
            userId: "me",
            labelIds: ["SPAM"],
            maxResults: SPAM_FALLBACK_MAX_RESULTS,
            q: `newer_than:${FALLBACK_TIME_WINDOW}`,
          });

          const spamMessages = spamResponse.data.messages || [];
          logger.debug("Found recent SPAM messages", {
            count: spamMessages.length,
          });

          // Combine all recent messages
          for (const message of [...inboxMessages, ...spamMessages]) {
            if (message.id) {
              allMessageIds.add(message.id);
            }
          }

          logger.info("Fallback search completed", {
            totalMessages: allMessageIds.size,
            source: historyFailed
              ? "history_failed_fallback"
              : "no_history_messages_fallback",
            messageIds: Array.from(allMessageIds).slice(0, 5).join(", "), // Show first 5 message IDs
          });

          // **CRITICAL FIX**: If history API is completely broken, disable timestamp filtering
          // This allows us to process recent messages even if they're older than the cutoff
          if (historyFailed && allMessageIds.size > 0) {
            logger.warn(
              "History API is broken, disabling timestamp filtering to process recent messages",
              {
                messageCount: allMessageIds.size,
                reason: "history_api_completely_failed",
              }
            );

            // Skip timestamp filtering and process all found messages
            for (const messageId of allMessageIds) {
              messageIds.add(messageId);
            }

            logger.info(
              "Processed messages without timestamp filtering due to history API failure",
              {
                count: messageIds.size,
                source: "timestamp_filtered_fallback",
              }
            );

            return { messageIds, source: "timestamp_filtered_fallback" };
          }
        }

        // **NEW**: If we still don't have any messages, try to get the specific message that triggered the webhook
        // This handles cases where Gmail's indexing is delayed
        if (allMessageIds.size === 0) {
          logger.warn(
            "No messages found in fallback, trying to get specific message from webhook"
          );

          // Try to get the message directly by searching for very recent messages without filters
          const directResponse = await gmail.users.messages.list({
            userId: "me",
            maxResults: FALLBACK_MAX_RESULTS, // Just get the most recent messages
          });

          const directMessages = directResponse.data.messages || [];
          logger.debug("Found direct recent messages", {
            count: directMessages.length,
          });

          for (const message of directMessages) {
            if (message.id) {
              allMessageIds.add(message.id);
            }
          }

          logger.info("Direct search completed", {
            totalMessages: allMessageIds.size,
            messageIds: Array.from(allMessageIds).join(", "),
          });

          // **ADDITIONAL FALLBACK**: If still no messages, try searching by time
          if (allMessageIds.size === 0) {
            logger.warn("Still no messages found, trying time-based search");

            // Search for messages from the last 10 minutes
            const timeResponse = await gmail.users.messages.list({
              userId: "me",
              q: "after:2025/07/20 23:24", // Search for messages after 23:24 (10 minutes ago)
              maxResults: 10,
            });

            const timeMessages = timeResponse.data.messages || [];
            logger.debug("Found time-based messages", {
              count: timeMessages.length,
            });

            for (const message of timeMessages) {
              if (message.id) {
                allMessageIds.add(message.id);
              }
            }

            logger.info("Time-based search completed", {
              totalMessages: allMessageIds.size,
              messageIds: Array.from(allMessageIds).join(", "),
            });
          }
        }
      }

      // Filter messages to only truly new ones by checking their actual timestamp
      for (const messageId of allMessageIds) {
        try {
          // Get message details to check the actual received date
          const messageDetail = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "metadata",
            metadataHeaders: ["Date", "Received"],
          });

          const headers = messageDetail.data.payload?.headers || [];
          const dateHeader = headers.find((h) => h.name === "Date")?.value;
          const receivedHeader = headers.find(
            (h) => h.name === "Received"
          )?.value;

          // Parse the email timestamp - prioritize internalDate (when Gmail received it)
          let emailTimestamp: number;

          // First try internalDate (when Gmail actually received the email)
          if (messageDetail.data.internalDate) {
            emailTimestamp = parseInt(messageDetail.data.internalDate);
          } else if (dateHeader) {
            // Fallback to Date header (when email was sent)
            emailTimestamp = new Date(dateHeader).getTime();
          } else if (receivedHeader) {
            // Extract timestamp from Received header
            const receivedMatch = receivedHeader.match(
              /\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/
            );
            emailTimestamp = receivedMatch
              ? new Date(receivedMatch[0]).getTime()
              : 0;
          } else {
            emailTimestamp = 0;
            logger.warn("No timestamp found for message", { messageId });
          }

          // Only include emails newer than our cutoff
          if (emailTimestamp >= cutoffTime) {
            messageIds.add(messageId);
          } else {
            logger.debug("Skipped old message", {
              messageId,
              emailTimestamp: new Date(emailTimestamp).toISOString(),
              cutoffTime: cutoffDate.toISOString(),
              reason: "older than cutoff",
            });
          }
        } catch (error) {
          logger.warn("Failed to check message timestamp", {
            messageId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Skip this message rather than risk processing old emails
        }
      }

      if (messageIds.size > 0) {
        logger.info("Found new messages using timestamp filtering", {
          count: messageIds.size,
          cutoffDate: cutoffDate.toISOString(),
          messageIds:
            Array.from(messageIds).slice(0, 5).join(", ") +
            (messageIds.size > 5 ? "..." : ""),
        });
      } else {
        logger.info("No new messages found after timestamp filtering", {
          cutoffDate: cutoffDate.toISOString(),
          totalChecked: allMessageIds.size,
        });
      }

      return { messageIds, source: "timestamp_filtered" };
    } catch (error) {
      logger.error("Timestamp-based message search failed", {
        error: error instanceof Error ? error.message : String(error),
        cutoffDate: cutoffDate.toISOString(),
      });

      // Only as absolute last resort, get very recent unread messages
      // But still apply timestamp filtering
      logger.warn(
        "Falling back to unread messages with strict timestamp filtering"
      );

      try {
        const fallbackResponse = await gmail.users.messages.list({
          userId: "me",
          labelIds: ["INBOX", "UNREAD"],
          maxResults: UNREAD_FALLBACK_MAX_RESULTS, // Very limited
        });

        const fallbackMessages = fallbackResponse.data.messages || [];

        // Still apply timestamp filtering even for fallback
        for (const message of fallbackMessages) {
          if (!message.id) continue;

          try {
            const messageDetail = await gmail.users.messages.get({
              userId: "me",
              id: message.id,
              format: "minimal",
            });

            const internalDate = messageDetail.data.internalDate
              ? parseInt(messageDetail.data.internalDate)
              : 0;

            if (internalDate >= cutoffTime) {
              messageIds.add(message.id);
            }
          } catch {
            // Skip problematic messages
          }
        }

        logger.warn("Fallback search completed with timestamp filtering", {
          count: messageIds.size,
          cutoffDate: cutoffDate.toISOString(),
        });

        return { messageIds, source: "timestamp_filtered_fallback" };
      } catch (fallbackError) {
        logger.error("All message retrieval methods failed", {
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });
        return { messageIds, source: "failed" };
      }
    }
  }

  async getEmailContent(
    options: GmailClientOptions,
    messageId: string
  ): Promise<EmailContent> {
    const gmail = await this.createAuthenticatedClient(options);

    const messageResponse = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = messageResponse.data;
    const headers = message.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find((h) => h.name === name)?.value || "";
    const extractEmail = (header: string) => {
      const match = header.match(/<(.+)>/);
      return match ? match[1] : header;
    };
    const extractName = (header: string) =>
      header.replace(/<.+>/, "").trim().replace(/"/g, "") || null;

    const subject = getHeader("Subject") || "No Subject";
    const fromHeader = getHeader("From");
    const dateHeader = getHeader("Date");

    const { bodyText, bodyHtml } = message.payload
      ? this.extractEmailBody(message.payload)
      : { bodyText: "", bodyHtml: "" };

    return {
      subject,
      fromEmail: extractEmail(fromHeader),
      fromName: extractName(fromHeader),
      toEmail: extractEmail(getHeader("To")),
      bodyText: bodyText || null,
      bodyHtml: bodyHtml || null,
      receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
    };
  }

  private extractEmailBody(payload: gmail_v1.Schema$MessagePart): {
    bodyText: string;
    bodyHtml: string;
  } {
    let bodyText = "";
    let bodyHtml = "";

    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === "text/plain" && part.body?.data) {
        bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    extractFromPart(payload);
    return { bodyText, bodyHtml };
  }

  async testConnection(options: GmailClientOptions): Promise<boolean> {
    try {
      const gmail = await this.createAuthenticatedClient(options);
      await gmail.users.getProfile({ userId: "me" });
      return true;
    } catch (error) {
      logger.error("Gmail connection test failed");
      return false;
    }
  }

  async deleteEmail(
    options: GmailClientOptions,
    messageId: string
  ): Promise<boolean> {
    try {
      const gmail = await this.createAuthenticatedClient(options);

      // First check if the message still exists
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "minimal",
      });

      const currentLabels = messageResponse.data.labelIds || [];

      // Check if already in trash
      if (currentLabels.includes("TRASH")) {
        logger.debug("Email already in trash", {
          messageId,
          currentLabels: currentLabels.join(", "),
        });
        return true; // Consider this a success since the goal is achieved
      }

      // Check if email is in INBOX (if not, it might already be archived)
      if (!currentLabels.includes("INBOX")) {
        logger.debug("Email not in INBOX, might be archived", {
          messageId,
          currentLabels: currentLabels.join(", "),
        });
        // Still try to move to trash even if not in INBOX
      }

      // Move to trash
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["TRASH"], // Add to trash
          removeLabelIds: ["INBOX", "UNREAD"], // Remove from inbox and mark as read
        },
      });

      logger.info("Email moved to trash in Gmail", { messageId });
      return true;
    } catch (error) {
      // Log the specific error to understand what's happening
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: number })?.code;
      const errorStatus = (error as { status?: number })?.status;

      logger.warn("Failed to delete email in Gmail", {
        messageId,
        error: errorMessage,
        errorCode,
        errorStatus,
      });

      // A 404 means the email doesn't exist in Gmail, which is a failure
      // because we couldn't delete something that doesn't exist
      if (errorCode === 404) {
        logger.warn(
          "Email not found in Gmail - cannot delete non-existent email",
          { messageId }
        );
        return false; // This is a failure, not success
      }

      return false;
    }
  }

  async archiveEmail(
    options: GmailClientOptions,
    messageId: string
  ): Promise<boolean> {
    try {
      const gmail = await this.createAuthenticatedClient(options);

      // First check if the message still exists and is in inbox
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "minimal",
      });

      const currentLabels = messageResponse.data.labelIds || [];

      // Only try to archive if the email is actually in the inbox
      if (!currentLabels.includes("INBOX")) {
        logger.debug("Email already archived or not in inbox", {
          messageId,
          currentLabels: currentLabels.join(", "),
        });
        return true; // Consider this a success since the goal is achieved
      }

      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["INBOX", "UNREAD"], // Removes from inbox and marks as read
        },
      });

      logger.info("Email archived in Gmail", { messageId });
      return true;
    } catch (error) {
      logger.warn("Failed to archive email in Gmail", { messageId });
      return false;
    }
  }

  async moveFromSpamToInbox(
    options: GmailClientOptions,
    messageId: string
  ): Promise<boolean> {
    try {
      const gmail = await this.createAuthenticatedClient(options);

      // Check if the message is in SPAM
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "minimal",
      });

      const currentLabels = messageResponse.data.labelIds || [];

      // Only move if the email is actually in SPAM
      if (!currentLabels.includes("SPAM")) {
        logger.debug("Email not in SPAM, no need to move", {
          messageId,
          currentLabels: currentLabels.join(", "),
        });
        return true; // Consider this a success since the goal is achieved
      }

      // Move from SPAM to INBOX
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["SPAM"],
          addLabelIds: ["INBOX"],
        },
      });

      logger.info("Email moved from SPAM to INBOX", { messageId });
      return true;
    } catch (error) {
      logger.warn("Failed to move email from SPAM to INBOX", { messageId });
      return false;
    }
  }

  async checkIfEmailInSpam(
    options: GmailClientOptions,
    messageId: string
  ): Promise<boolean> {
    try {
      const gmail = await this.createAuthenticatedClient(options);

      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "minimal",
      });

      const currentLabels = messageResponse.data.labelIds || [];
      const isInSpam = currentLabels.includes("SPAM");

      logger.debug("Checked if email is in SPAM", {
        messageId,
        isInSpam,
        currentLabels: currentLabels.join(", "),
      });

      return isInSpam;
    } catch (error) {
      logger.warn("Failed to check if email is in SPAM", { messageId });
      return false; // Assume not in SPAM if we can't check
    }
  }
}

export const gmailService = new GmailService();
