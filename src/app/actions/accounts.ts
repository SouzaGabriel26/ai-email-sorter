"use server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { getServerSession } from "next-auth";

export interface ConnectedAccount {
  id: string;
  email: string;
  name: string;
  image: string;
  isActive: boolean;
  connectedAt: Date;
  hasActiveWatch: boolean;
  watchExpiresAt?: Date;
  lastSyncAt?: Date;
  totalEmails?: number;
}

interface AccountsResponse {
  success: boolean;
  accounts?: ConnectedAccount[];
  error?: string;
}

interface DisconnectAccountResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface SetupWatchResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface ConnectAccountResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export async function getConnectedAccountsAction(): Promise<AccountsResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: {
          where: { provider: "google" },
          orderBy: { createdAt: "asc" },
        },
        gmailWatches: {
          where: { isActive: true },
        },
        emails: {
          select: {
            accountEmail: true,
            processedAt: true,
          },
          orderBy: { processedAt: "desc" },
          take: 1000, // Limit for performance
        },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get Gmail profile information for each account
    const accountsWithInfo = await Promise.all(
      user.accounts.map(async (account) => {
        try {
          if (!account.access_token) {
            return {
              id: account.id,
              email: account.providerAccountId,
              name: "Connection Error",
              image: "",
              isActive: false,
              connectedAt: account.createdAt,
              hasActiveWatch: false,
              totalEmails: 0,
            };
          }

          // Create Gmail client with token refresh handling
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );

          const now = Math.floor(Date.now() / 1000);
          const isTokenExpired = account.expires_at && account.expires_at < now;

          if (isTokenExpired && account.refresh_token) {
            try {
              oauth2Client.setCredentials({
                refresh_token: account.refresh_token,
              });
              const { credentials } = await oauth2Client.refreshAccessToken();

              if (credentials.access_token) {
                await prisma.account.update({
                  where: { id: account.id },
                  data: {
                    access_token: credentials.access_token,
                    ...(credentials.refresh_token && {
                      refresh_token: credentials.refresh_token,
                    }),
                    expires_at: credentials.expiry_date
                      ? Math.floor(credentials.expiry_date / 1000)
                      : null,
                  },
                });
                oauth2Client.setCredentials({
                  access_token: credentials.access_token,
                  refresh_token: account.refresh_token,
                });
              }
            } catch (refreshError) {
              console.error(
                `Token refresh failed for account ${account.id}:`,
                refreshError
              );
              return {
                id: account.id,
                email: account.providerAccountId,
                name: "Token Expired",
                image: "",
                isActive: false,
                connectedAt: account.createdAt,
                hasActiveWatch: false,
                totalEmails: 0,
              };
            }
          } else {
            oauth2Client.setCredentials({
              access_token: account.access_token,
              refresh_token: account.refresh_token,
            });
          }

          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const profile = await gmail.users.getProfile({ userId: "me" });

          const emailAddress =
            profile.data.emailAddress || account.providerAccountId;

          // Find corresponding watch
          const watch = user.gmailWatches.find(
            (w) => w.accountEmail === emailAddress
          );

          // Count emails for this account
          const accountEmails = user.emails.filter(
            (email) => email.accountEmail === emailAddress
          );

          // Get latest email timestamp for this account
          const lastSyncAt =
            accountEmails.length > 0 && accountEmails[0]?.processedAt
              ? accountEmails[0].processedAt
              : undefined;

          return {
            id: account.id,
            email: emailAddress,
            name: user.name || "Gmail User",
            image: user.image || "",
            isActive: true,
            connectedAt: account.createdAt,
            hasActiveWatch: !!watch && watch.expiresAt > new Date(),
            watchExpiresAt: watch?.expiresAt,
            lastSyncAt,
            totalEmails: accountEmails.length,
          };
        } catch (error) {
          console.error(
            `Error fetching account info for ${account.id}:`,
            error
          );
          return {
            id: account.id,
            email: account.providerAccountId,
            name: "Connection Error",
            image: "",
            isActive: false,
            connectedAt: account.createdAt,
            hasActiveWatch: false,
            totalEmails: 0,
          };
        }
      })
    );

    return { success: true, accounts: accountsWithInfo };
  } catch (error) {
    console.error("Get connected accounts error:", error);
    return { success: false, error: "Failed to fetch connected accounts" };
  }
}

export async function disconnectAccountAction(
  accountId: string
): Promise<DisconnectAccountResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: { where: { provider: "google" } },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if this is the last account
    if (user.accounts.length <= 1) {
      return {
        success: false,
        error:
          "Cannot disconnect the last connected account. You need at least one Gmail account to use the service.",
      };
    }

    const account = user.accounts.find((acc) => acc.id === accountId);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // Get account email for cleanup
    let accountEmail = account.providerAccountId;
    try {
      if (account.access_token) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ access_token: account.access_token });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        accountEmail = profile.data.emailAddress || accountEmail;

        // Stop Gmail watch
        await gmail.users.stop({ userId: "me" });
      }
    } catch (error) {
      console.warn("Failed to stop Gmail watch during disconnect:", error);
    }

    // Clean up database records
    await prisma.$transaction([
      // Deactivate Gmail watches
      prisma.gmailWatch.updateMany({
        where: {
          userId: user.id,
          accountEmail: accountEmail,
        },
        data: { isActive: false },
      }),
      // Delete the account
      prisma.account.delete({
        where: { id: accountId },
      }),
    ]);

    return {
      success: true,
      message: `Gmail account ${accountEmail} has been disconnected successfully.`,
    };
  } catch (error) {
    console.error("Disconnect account error:", error);
    return { success: false, error: "Failed to disconnect account" };
  }
}

export async function setupWatchForAccountAction(
  accountId: string
): Promise<SetupWatchResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: { where: { provider: "google", id: accountId } },
      },
    });

    if (!user || !user.accounts[0]) {
      return { success: false, error: "Account not found" };
    }

    const account = user.accounts[0];
    if (!account.access_token) {
      return { success: false, error: "Invalid account credentials" };
    }

    // Use the existing Gmail utils to set up the watch
    const { setupGmailWatchForUser } = await import("@/lib/gmail-utils");
    const result = await setupGmailWatchForUser(
      user.id,
      account.access_token,
      account.refresh_token || undefined
    );

    if (result.success) {
      return {
        success: true,
        message: `Gmail monitoring enabled for ${result.accountEmail}`,
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to enable monitoring",
      };
    }
  } catch (error) {
    console.error("Setup watch error:", error);
    return { success: false, error: "Failed to enable monitoring" };
  }
}

export async function connectAccountAction(): Promise<ConnectAccountResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Not authenticated" };
    }

    // Check current account limit (reasonable limit for performance)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: { where: { provider: "google" } },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.accounts.length >= 10) {
      return {
        success: false,
        error:
          "Maximum number of connected accounts (10) reached. Please disconnect an account before adding a new one.",
      };
    }

    // Just return success - client will handle NextAuth signIn
    return { success: true };
  } catch (error) {
    console.error("Connect account error:", error);
    return { success: false, error: "Failed to prepare account connection" };
  }
}
