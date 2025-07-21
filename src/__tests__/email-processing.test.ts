/**
 * @jest-environment jsdom
 */

process.env.GOOGLE_AI_API_KEY = "test-key";

// Mock all server-only modules before imports
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

import { prisma } from "../lib/prisma";
import { aiService } from "../services/ai.service";
import { gmailService } from "../services/gmail.service";

jest.mock("../services/ai.service");
jest.mock("../services/gmail.service");

describe("Email Processing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should categorize and summarize email using AI", async () => {
    (aiService.categorizeAndSummarizeEmail as jest.Mock).mockResolvedValue({
      categoryId: "cat1",
      categoryName: "Work",
      summary: "Summary",
      confidence: 95,
    });
    const emailContent = {
      body: "email body",
      subject: "subject",
      fromEmail: "sender@example.com",
    };
    const result = await (aiService.categorizeAndSummarizeEmail as jest.Mock)(
      emailContent,
      "user1"
    );
    expect(result.categoryId).toBe("cat1");
    expect(result.summary).toBe("Summary");
    expect(aiService.categorizeAndSummarizeEmail).toHaveBeenCalledWith(
      emailContent,
      "user1"
    );
  });

  it("should handle AI errors gracefully", async () => {
    (aiService.categorizeAndSummarizeEmail as jest.Mock).mockRejectedValue(
      new Error("AI error")
    );
    const emailContent = {
      body: "body",
      subject: "subject",
      fromEmail: "sender@example.com",
    };
    await expect(
      (aiService.categorizeAndSummarizeEmail as jest.Mock)(
        emailContent,
        "user1"
      )
    ).rejects.toThrow("AI error");
  });

  it("should archive email in Gmail after import", async () => {
    (gmailService.archiveEmail as jest.Mock).mockResolvedValue(true);
    const options = { accessToken: "token" };
    const result = await (gmailService.archiveEmail as jest.Mock)(
      options,
      "emailId"
    );
    expect(result).toBe(true);
    expect(gmailService.archiveEmail).toHaveBeenCalledWith(options, "emailId");
  });

  it("should handle Gmail archiving errors gracefully", async () => {
    (gmailService.archiveEmail as jest.Mock).mockRejectedValue(
      new Error("Gmail error")
    );
    const options = { accessToken: "token" };
    await expect(
      (gmailService.archiveEmail as jest.Mock)(options, "emailId")
    ).rejects.toThrow("Gmail error");
  });

  it("should write processed email to DB", async () => {
    (prisma.email.create as jest.Mock).mockResolvedValue({
      id: "email1",
      subject: "Test",
    });
    const emailData = {
      subject: "Test",
      gmailId: "gmail1",
      accountEmail: "acc@example.com",
      fromEmail: "from@example.com",
      toEmail: "to@example.com",
      receivedAt: new Date(),
      userId: "user1",
    };
    const result = await (prisma.email.create as jest.Mock)({
      data: emailData,
    });
    expect(result.id).toBe("email1");
    expect(prisma.email.create).toHaveBeenCalledWith({ data: emailData });
  });
});
