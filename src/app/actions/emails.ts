"use server";

import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

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

export async function deleteEmailAction(emailId: string) {
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

    // Get the email details first
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: user.id, // Ensure user owns the email
      },
    });

    if (!email) {
      throw new Error("Email not found");
    }

    // Get the user's Gmail account credentials
    // We need to find the account that matches the email address
    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: "google",
        // Try to find by providerAccountId first (which might be the email)
        OR: [
          { providerAccountId: email.accountEmail },
          // If that doesn't work, we'll need to get the account email from the profile
        ],
      },
    });

    if (!account?.access_token) {
      // If we can't find the account by providerAccountId, try to get it from the user's accounts
      // This is a fallback for cases where the providerAccountId doesn't match the email
      const userAccounts = await prisma.account.findMany({
        where: {
          userId: user.id,
          provider: "google",
        },
      });

      if (userAccounts.length === 0) {
        throw new Error("No Gmail accounts found for user");
      }

      // Try each account until one works
      for (const fallbackAccount of userAccounts) {
        if (!fallbackAccount.access_token) continue;

        try {
          const clientOptions = {
            accessToken: fallbackAccount.access_token,
            refreshToken: fallbackAccount.refresh_token || undefined,
            expiresAt: fallbackAccount.expires_at
              ? new Date(fallbackAccount.expires_at).getTime()
              : undefined,
            accountId: fallbackAccount.id,
          };

          // Try to delete from this account
          const { gmailService } = await import("@/services/gmail.service");
          const gmailDeleted = await gmailService.deleteEmail(
            clientOptions,
            email.gmailId
          );

          if (gmailDeleted) {
            // Success! Delete from database
            await prisma.email.delete({
              where: {
                id: emailId,
                userId: user.id,
              },
            });

            revalidatePath("/dashboard", "page");
            revalidatePath("/category/[id]", "page");

            return {
              success: true,
              gmailDeleted: true,
            };
          }
        } catch (error) {
          // Continue to next account
        }
      }

      // If we get here, none of the accounts worked
      throw new Error("Failed to delete email from any Gmail account");
    }

    // Import the Gmail service singleton
    const { gmailService } = await import("@/services/gmail.service");

    // Prepare Gmail client options
    const clientOptions = {
      accessToken: account.access_token,
      refreshToken: account.refresh_token || undefined,
      expiresAt: account.expires_at
        ? new Date(account.expires_at).getTime()
        : undefined,
      accountId: account.id,
    };

    // Delete from Gmail first
    const gmailDeleted = await gmailService.deleteEmail(
      clientOptions,
      email.gmailId
    );

    // Only delete from database if Gmail deletion was successful or if it's a 404 (email not found)
    // This prevents orphaned database records
    if (gmailDeleted) {
      // Delete from database
      await prisma.email.delete({
        where: {
          id: emailId,
          userId: user.id,
        },
      });

      // Revalidate the dashboard to refresh stats
      revalidatePath("/dashboard", "page");
      revalidatePath("/category/[id]", "page");

      return {
        success: true,
        gmailDeleted: true,
      };
    } else {
      // Gmail deletion failed, but we should still delete from database
      // to prevent orphaned records, but log this as a warning
      logger.warn(
        "Gmail deletion failed, but deleting from database to prevent orphaned records",
        {
          emailId,
          gmailId: email.gmailId,
        }
      );

      // Delete from database
      await prisma.email.delete({
        where: {
          id: emailId,
          userId: user.id,
        },
      });

      // Revalidate the dashboard to refresh stats
      revalidatePath("/dashboard", "page");
      revalidatePath("/category/[id]", "page");

      return {
        success: true,
        gmailDeleted: false,
      };
    }
  } catch (error) {
    console.error("Delete email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete email",
    };
  }
}
