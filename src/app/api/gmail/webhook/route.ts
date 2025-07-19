import { prisma } from "@/lib/prisma";
import { publishEmailProcessingJob } from "@/lib/qstash";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PubSubMessage;
    console.log("webhook body:", body);

    if (!body.message?.data) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const decodedData = Buffer.from(body.message.data, "base64").toString(
      "utf-8"
    );

    let gmailNotification: GmailNotification;
    try {
      gmailNotification = JSON.parse(decodedData);
    } catch {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!gmailNotification.emailAddress || !gmailNotification.historyId) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { email: gmailNotification.emailAddress },
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
        gmailWatches: {
          where: {
            accountEmail: gmailNotification.emailAddress,
            isActive: true,
          },
          select: {
            id: true,
            historyId: true,
          },
        },
      },
    });

    if (!user?.accounts[0]?.access_token || !user.gmailWatches[0]) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const account = user.accounts[0];

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
    } catch (qstashError) {
      console.error("Failed to publish QStash job:", qstashError);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Gmail webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
