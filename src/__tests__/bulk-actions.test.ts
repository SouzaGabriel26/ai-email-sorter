/**
 * @jest-environment jsdom
 * @type {import('jest').Jest}
 */

process.env.GOOGLE_AI_API_KEY = "test-key";

jest.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    email: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { deleteEmailAction } from "../app/actions/emails";
import { unsubscribeFromEmailsAction } from "../app/actions/unsubscribe";
import { prisma } from "../lib/prisma";
import { browserService } from "../services/browser.service";
import { gmailService } from "../services/gmail.service";

jest.mock("../services/gmail.service");
jest.mock("../services/browser.service");

describe("Bulk Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { email: "test@example.com" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user1",
      email: "test@example.com",
    });
    (prisma.email.findFirst as jest.Mock).mockResolvedValue({
      id: "email1",
      gmailId: "gmail1",
      accountEmail: "test@example.com",
      fromEmail: "from@example.com",
      toEmail: "to@example.com",
      userId: "user1",
    });
    (prisma.account.findFirst as jest.Mock).mockResolvedValue({
      access_token: "token",
      refresh_token: "refresh",
      expires_at: Date.now() / 1000 + 3600,
      id: "account1",
    });
    (prisma.account.findMany as jest.Mock).mockResolvedValue([
      {
        access_token: "token",
        refresh_token: "refresh",
        expires_at: Date.now() / 1000 + 3600,
        id: "account1",
      },
    ]);
  });

  it("should delete email from Gmail and DB", async () => {
    (prisma.email.delete as jest.Mock).mockResolvedValue({});
    (gmailService.deleteEmail as jest.Mock).mockResolvedValue(true);
    const result = await deleteEmailAction("email1");
    expect(result.success).toBe(true);
    expect(gmailService.deleteEmail).toHaveBeenCalled();
    expect(prisma.email.delete).toHaveBeenCalled();
  });

  it("should handle Gmail deletion failure gracefully", async () => {
    (gmailService.deleteEmail as jest.Mock).mockRejectedValue(
      new Error("Gmail error")
    );
    (prisma.email.delete as jest.Mock).mockResolvedValue({});
    const result = await deleteEmailAction("email1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Gmail error/);
  });

  it("should handle DB deletion failure gracefully", async () => {
    (gmailService.deleteEmail as jest.Mock).mockResolvedValue(true);
    (prisma.email.delete as jest.Mock).mockRejectedValue(new Error("DB error"));
    const result = await deleteEmailAction("email1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/DB error/);
  });

  it("should unsubscribe from emails using browser automation", async () => {
    (prisma.email.findMany as jest.Mock).mockResolvedValue([
      {
        id: "email1",
        subject: "Test",
        fromEmail: "from@example.com",
        fromName: "From",
        toEmail: "to@example.com",
        bodyText: "body",
        bodyHtml: '<a href="https://unsubscribe.com">Unsubscribe</a>',
        unsubscribeLinks: JSON.stringify([
          {
            url: "https://unsubscribe.com",
            text: "Unsubscribe",
            type: "link",
            confidence: 0.95,
          },
        ]),
      },
    ]);
    (prisma.email.update as jest.Mock).mockResolvedValue({});
    (browserService.unsubscribeFromLink as jest.Mock).mockResolvedValue({
      success: true,
      status: "completed",
      actionsTaken: ["clicked link"],
    });
    const result = await unsubscribeFromEmailsAction(["email1"]);
    expect(result[0].status).toBe("completed");
    expect(result[0].error).toBeUndefined();
    expect(browserService.unsubscribeFromLink).toHaveBeenCalledWith(
      {
        url: "https://unsubscribe.com",
        text: "Unsubscribe",
        type: "link",
        confidence: 0.95,
      },
      "to@example.com"
    );
  });

  it("should handle unsubscribe failure gracefully", async () => {
    (prisma.email.findMany as jest.Mock).mockResolvedValue([
      {
        id: "email1",
        subject: "Test",
        fromEmail: "from@example.com",
        fromName: "From",
        toEmail: "to@example.com",
        bodyText: "body",
        bodyHtml: '<a href="https://unsubscribe.com">Unsubscribe</a>',
        unsubscribeLinks: JSON.stringify([
          {
            url: "https://unsubscribe.com",
            text: "Unsubscribe",
            type: "link",
            confidence: 0.95,
          },
        ]),
      },
    ]);
    (prisma.email.update as jest.Mock).mockResolvedValue({});
    (browserService.unsubscribeFromLink as jest.Mock).mockResolvedValue({
      success: false,
      status: "failed",
      actionsTaken: [],
      error: "No link found",
    });
    const result = await unsubscribeFromEmailsAction(["email1"]);
    expect(result[0].status).toBe("failed");
    expect(result[0].error).toBe("No link found");
  });
});
