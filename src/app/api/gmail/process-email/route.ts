import { prisma } from "@/lib/prisma";
import type { EmailProcessingJobData } from "@/lib/qstash";
import { google, type gmail_v1 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

async function createGmailClient(data: EmailProcessingJobData) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  const now = Math.floor(Date.now() / 1000);
  const isTokenExpired = data.expiresAt && data.expiresAt < now;

  if (isTokenExpired) {
    if (!data.refreshToken) {
      throw new Error("Access token expired and no refresh token available");
    }

    oauth2Client.setCredentials({ refresh_token: data.refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to get new access token from refresh");
    }

    await prisma.account.update({
      where: { id: data.accountId },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : null,
      },
    });

    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: data.refreshToken,
    });
  } else {
    oauth2Client.setCredentials({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

function extractEmailBody(payload: gmail_v1.Schema$MessagePart): {
  bodyText: string;
  bodyHtml: string;
} {
  let bodyText = "";
  let bodyHtml = "";

  function extractFromPart(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.parts) {
      part.parts.forEach(extractFromPart);
    }
  }

  extractFromPart(payload);
  return { bodyText, bodyHtml };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EmailProcessingJobData;
    const {
      emailAddress,
      historyId,
      userId,
      accountId,
      accessToken,
      refreshToken,
      expiresAt,
    } = body;

    if (!emailAddress || !historyId || !userId || !accountId || !accessToken) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "No active watch" }, { status: 404 });
    }

    let gmail;
    try {
      gmail = await createGmailClient({
        emailAddress,
        historyId,
        userId,
        accountId,
        accessToken,
        refreshToken,
        expiresAt,
      });
    } catch (authError) {
      await prisma.gmailWatch.update({
        where: { id: gmailWatch.id },
        data: { isActive: false },
      });

      return NextResponse.json(
        {
          error: "Authentication failed",
          details:
            authError instanceof Error
              ? authError.message
              : "Unknown auth error",
        },
        { status: 401 }
      );
    }

    const historyResponse = await gmail.users.history.list({
      userId: "me",
      startHistoryId: gmailWatch.historyId,
      labelId: "INBOX",
    });

    const history = historyResponse.data.history || [];
    const messageIds = new Set<string>();

    for (const historyItem of history) {
      if (historyItem.messagesAdded) {
        for (const messageAdded of historyItem.messagesAdded) {
          if (messageAdded.message?.id) {
            messageIds.add(messageAdded.message.id);
          }
        }
      }
    }

    let processedCount = 0;
    for (const messageId of messageIds) {
      try {
        const existingEmail = await prisma.email.findUnique({
          where: { gmailId: messageId },
        });

        if (existingEmail) continue;

        const messageResponse = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

        const message = messageResponse.data;
        const headers = message.payload?.headers || [];

        const subject =
          headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const fromHeader = headers.find((h) => h.name === "From")?.value || "";
        const toHeader = headers.find((h) => h.name === "To")?.value || "";
        const dateHeader = headers.find((h) => h.name === "Date")?.value;

        const fromEmail = fromHeader.match(/<(.+)>/)
          ? fromHeader.match(/<(.+)>/)![1]
          : fromHeader;
        const fromName = fromHeader
          .replace(/<.+>/, "")
          .trim()
          .replace(/"/g, "");
        const toEmail = toHeader.match(/<(.+)>/)
          ? toHeader.match(/<(.+)>/)![1]
          : toHeader;
        const receivedAt = dateHeader ? new Date(dateHeader) : new Date();

        const { bodyText, bodyHtml } = message.payload
          ? extractEmailBody(message.payload)
          : { bodyText: "", bodyHtml: "" };

        console.log(`Processing email: ${subject} from ${fromEmail}`);

        await prisma.email.create({
          data: {
            gmailId: messageId,
            userId,
            accountEmail: emailAddress,
            subject,
            fromEmail,
            fromName: fromName || null,
            toEmail,
            bodyText: bodyText || null,
            bodyHtml: bodyHtml || null,
            receivedAt,
            processedAt: new Date(),
            aiSummary: null, // TODO: Add AI-generated summary of email content
            categoryId: null, // TODO: Add categoryId
          },
        });

        processedCount++;
      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error);
      }
    }

    if (messageIds.size > 0) {
      await prisma.gmailWatch.update({
        where: { id: gmailWatch.id },
        data: { historyId: String(historyId) },
      });
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      messages: Array.from(messageIds),
    });
  } catch (error) {
    console.error("Email processing worker error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
