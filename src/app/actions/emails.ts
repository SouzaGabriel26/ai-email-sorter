"use server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export type EmailWithCategory = {
  id: string;
  gmailId: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  aiSummary: string | null;
  isArchived: boolean;
  receivedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  category: {
    id: string;
    name: string;
    description: string;
  } | null;
};

export type EmailDetails = {
  id: string;
  gmailId: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  bodyText: string | null;
  bodyHtml: string | null;
  aiSummary: string | null;
  isArchived: boolean;
  receivedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  category: {
    id: string;
    name: string;
    description: string;
  } | null;
};

export async function getEmailsAction(
  categoryId?: string
): Promise<EmailWithCategory[]> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return [];
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return [];
    }

    const whereClause: {
      userId: string;
      processedAt: { not: null };
      categoryId?: string;
    } = {
      userId: user.id,
      processedAt: { not: null }, // Only show processed emails
    };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    const emails = await prisma.email.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 100, // Limit to prevent performance issues
    });

    return emails;
  } catch (error) {
    console.error("Get emails error:", error);
    return [];
  }
}

export async function getEmailDetailsAction(
  emailId: string
): Promise<EmailDetails | null> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      throw new Error("Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: user.id, // Ensure user can only access their own emails
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    return email;
  } catch (error) {
    console.error("Get email details error:", error);
    return null;
  }
}

export async function getEmailStatsAction() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return {
        totalEmails: 0,
        categorizedEmails: 0,
        uncategorizedEmails: 0,
        categoriesCount: 0,
        lastProcessedAt: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return {
        totalEmails: 0,
        categorizedEmails: 0,
        uncategorizedEmails: 0,
        categoriesCount: 0,
        lastProcessedAt: null,
      };
    }

    // Get email stats
    const [
      totalEmails,
      categorizedEmails,
      categoriesCount,
      lastProcessedEmail,
    ] = await Promise.all([
      prisma.email.count({
        where: {
          userId: user.id,
          processedAt: { not: null },
        },
      }),
      prisma.email.count({
        where: {
          userId: user.id,
          categoryId: { not: null },
          processedAt: { not: null },
        },
      }),
      prisma.category.count({
        where: { userId: user.id },
      }),
      prisma.email.findFirst({
        where: {
          userId: user.id,
          processedAt: { not: null },
        },
        orderBy: { processedAt: "desc" },
        select: { processedAt: true },
      }),
    ]);

    const uncategorizedEmails = totalEmails - categorizedEmails;

    return {
      totalEmails,
      categorizedEmails,
      uncategorizedEmails,
      categoriesCount,
      lastProcessedAt: lastProcessedEmail?.processedAt || null,
    };
  } catch (error) {
    console.error("Get email stats error:", error);
    return {
      totalEmails: 0,
      categorizedEmails: 0,
      uncategorizedEmails: 0,
      categoriesCount: 0,
      lastProcessedAt: null,
    };
  }
}

export async function getEmailsByCategoryAction() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return [];
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return [];
    }

    // Get categories with email counts
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            emails: {
              where: {
                processedAt: { not: null },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also get uncategorized emails count
    const uncategorizedCount = await prisma.email.count({
      where: {
        userId: user.id,
        categoryId: null,
        processedAt: { not: null },
      },
    });

    // Add uncategorized as a special category if there are any
    const result = [...categories];
    if (uncategorizedCount > 0) {
      result.push({
        id: "uncategorized",
        name: "Uncategorized",
        description: "Emails that couldn't be automatically categorized",
        _count: {
          emails: uncategorizedCount,
        },
      });
    }

    return result;
  } catch (error) {
    console.error("Get emails by category error:", error);
    return [];
  }
}

export async function searchEmailsAction(
  query: string
): Promise<EmailWithCategory[]> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return [];
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return [];
    }

    const emails = await prisma.email.findMany({
      where: {
        userId: user.id,
        processedAt: { not: null },
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { fromEmail: { contains: query, mode: "insensitive" } },
          { fromName: { contains: query, mode: "insensitive" } },
          { aiSummary: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 50, // Limit search results
    });

    return emails;
  } catch (error) {
    console.error("Search emails error:", error);
    return [];
  }
}
