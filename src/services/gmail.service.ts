import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { google, type gmail_v1 } from "googleapis";

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
  source: "history" | "recent_history" | "message_list";
}

export class GmailService {
  private async createAuthenticatedClient(
    options: GmailClientOptions
  ): Promise<gmail_v1.Gmail> {
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
    currentHistoryId: string
  ): Promise<MessageSearchResult> {
    const gmail = await this.createAuthenticatedClient(options);
    const messageIds = new Set<string>();

    // Helper to extract message IDs from history
    const extractMessageIds = (history: gmail_v1.Schema$History[]) => {
      history.forEach((historyItem) => {
        historyItem.messagesAdded?.forEach(
          (messageAdded: gmail_v1.Schema$HistoryMessageAdded) => {
            if (messageAdded.message?.id) {
              messageIds.add(messageAdded.message.id);
            }
          }
        );
      });
    };

    // Try stored historyId first
    try {
      logger.debug("Attempting history API", { storedHistoryId });
      const historyResponse = await gmail.users.history.list({
        userId: "me",
        startHistoryId: storedHistoryId,
        labelId: "INBOX",
      });

      const historyItems = historyResponse.data.history || [];
      extractMessageIds(historyItems);

      if (messageIds.size > 0) {
        logger.info("Found messages via history API", {
          count: messageIds.size,
        });
        return { messageIds, source: "history" };
      }
    } catch (error) {
      logger.warn("History API failed", { storedHistoryId });
    }

    // Fallback: try recent history from profile
    try {
      const profile = await gmail.users.getProfile({ userId: "me" });
      const profileHistoryId = profile.data.historyId;

      if (profileHistoryId && profileHistoryId !== storedHistoryId) {
        const recentStartId = Math.max(
          1,
          parseInt(profileHistoryId) - 100
        ).toString();
        logger.debug("Trying recent history fallback", { recentStartId });

        const recentHistoryResponse = await gmail.users.history.list({
          userId: "me",
          startHistoryId: recentStartId,
          labelId: "INBOX",
        });

        const recentHistoryItems = recentHistoryResponse.data.history || [];
        extractMessageIds(recentHistoryItems);

        if (messageIds.size > 0) {
          logger.info("Found messages via recent history", {
            count: messageIds.size,
          });
          return { messageIds, source: "recent_history" };
        }
      }
    } catch (error) {
      logger.warn("Recent history fallback failed");
    }

    // Final fallback: get recent messages
    logger.warn("Using message list fallback");

    try {
      const messagesResponse = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        maxResults: 20,
      });

      messagesResponse.data.messages?.forEach((message) => {
        if (message.id) messageIds.add(message.id);
      });

      logger.info("Found messages via message list", {
        count: messageIds.size,
      });
      return { messageIds, source: "message_list" };
    } catch (error) {
      logger.error("All message retrieval methods failed");
      return { messageIds, source: "message_list" };
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
}

export const gmailService = new GmailService();
