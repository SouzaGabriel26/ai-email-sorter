"use server";

import { authOptions } from "@/lib/auth";
import { setupGmailWatchForUser } from "@/lib/gmail-utils";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { getServerSession } from "next-auth";

async function getAllGmailClients() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const accounts = await prisma.account.findMany({
    where: {
      userId: user.id,
      provider: "google",
    },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    throw new Error(
      "No Google accounts found. Please sign out and sign in again."
    );
  }

  const gmailClients = await Promise.all(
    accounts
      .filter((account) => {
        const accessToken = session.accessToken || account.access_token;
        return !!accessToken;
      })
      .map(async (account) => {
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
          } catch (error) {
            console.error(
              `Failed to refresh token for account ${account.providerAccountId}:`,
              error
            );
            throw new Error(
              `Token refresh failed for account ${account.providerAccountId}`
            );
          }
        } else {
          const accessToken = session.accessToken || account.access_token;
          const refreshToken = account.refresh_token;

          oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // Get email address for this account
        let emailAddress = account.providerAccountId;
        try {
          const profile = await gmail.users.getProfile({ userId: "me" });
          emailAddress = profile.data.emailAddress || account.providerAccountId;
        } catch (error) {
          console.warn(
            `Failed to get profile for account ${account.id}:`,
            error
          );
        }

        return { gmail, account, emailAddress };
      })
  );

  if (gmailClients.length === 0) {
    throw new Error(
      "No valid Gmail accounts found. Please reconnect your accounts."
    );
  }

  return { user, gmailClients };
}

interface TestResult {
  email: string;
  accountId: string;
  success: boolean;
}

interface WatchResult {
  accountEmail: string;
  status: "started" | "already_active";
  expiresAt: Date;
}

export async function testGmailConnectionAction() {
  try {
    const { gmailClients } = await getAllGmailClients();

    const results = await Promise.allSettled(
      gmailClients.map(
        async ({ gmail, account, emailAddress }): Promise<TestResult> => {
          await gmail.users.getProfile({ userId: "me" });
          return {
            email: emailAddress,
            accountId: account.providerAccountId,
            success: true,
          };
        }
      )
    );

    const successful = results
      .filter(
        (result): result is PromiseFulfilledResult<TestResult> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);

    const failed = results.filter(
      (result) => result.status === "rejected"
    ).length;

    if (successful.length === 0) {
      return {
        success: false,
        error:
          "All Gmail connections failed. Please sign out and sign in again.",
      };
    }

    return {
      success: true,
      accounts: successful,
      message:
        failed > 0
          ? `${successful.length} accounts connected, ${failed} failed`
          : `All ${successful.length} accounts connected successfully`,
    };
  } catch (error) {
    console.error("Gmail test failed:", error);
    return {
      success: false,
      error:
        "Authentication failed. Please sign out and sign in again to refresh your Google credentials.",
    };
  }
}

export async function startGmailWatchAction() {
  try {
    const { user, gmailClients } = await getAllGmailClients();

    const results = await Promise.allSettled(
      gmailClients.map(
        async ({ account, emailAddress }): Promise<WatchResult> => {
          const result = await setupGmailWatchForUser(
            user.id,
            account.access_token!,
            account.refresh_token || undefined
          );

          if (!result.success) {
            throw new Error(result.error);
          }

          return {
            accountEmail: result.accountEmail!,
            status: result.status!,
            expiresAt: result.expiresAt!,
          };
        }
      )
    );

    const successful = results
      .filter(
        (result): result is PromiseFulfilledResult<WatchResult> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);

    const failed = results.filter(
      (result) => result.status === "rejected"
    ).length;

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Account ${index + 1} failed with error:`, result.reason);
      }
    });

    const newWatches = successful.filter((r) => r.status === "started").length;
    const alreadyActive = successful.filter(
      (r) => r.status === "already_active"
    ).length;

    let message = "";
    if (newWatches > 0 && alreadyActive > 0) {
      message = `Started monitoring ${newWatches} accounts, ${alreadyActive} already active`;
    } else if (newWatches > 0) {
      message = `Started monitoring ${newWatches} Gmail account${
        newWatches > 1 ? "s" : ""
      }`;
    } else if (alreadyActive > 0) {
      message = `All ${alreadyActive} Gmail account${
        alreadyActive > 1 ? "s are" : " is"
      } already being monitored`;
    }

    if (failed > 0) {
      message += `, ${failed} failed`;
    }

    return {
      success: successful.length > 0,
      message,
      accounts: successful,
    };
  } catch (error) {
    console.error("Gmail watch failed:", error);
    return {
      success: false,
      error:
        "Failed to start Gmail monitoring. Please ensure you have proper permissions and try again.",
    };
  }
}

export async function stopGmailWatchAction() {
  try {
    const { user, gmailClients } = await getAllGmailClients();

    const results = await Promise.allSettled(
      gmailClients.map(async ({ gmail }) => {
        await gmail.users.stop({ userId: "me" });
      })
    );

    await prisma.gmailWatch.updateMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      data: { isActive: false },
    });

    const successful = results.filter(
      (result) => result.status === "fulfilled"
    ).length;
    const failed = results.filter(
      (result) => result.status === "rejected"
    ).length;

    return {
      success: true,
      message:
        failed > 0
          ? `Stopped ${successful} accounts, ${failed} failed`
          : `Stopped monitoring all ${successful} Gmail accounts`,
    };
  } catch (error) {
    console.error("Stop Gmail watch failed:", error);
    return {
      success: false,
      error: "Failed to stop Gmail monitoring",
    };
  }
}

export async function getGmailWatchStatusAction() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return { isActive: false, accounts: [] };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { isActive: false, accounts: [] };
    }

    const activeWatches = await prisma.gmailWatch.findMany({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalAccounts = await prisma.account.count({
      where: {
        userId: user.id,
        provider: "google",
      },
    });

    return {
      isActive: activeWatches.length > 0,
      activeWatches: activeWatches.length,
      totalAccounts,
      expiresAt: activeWatches[0]?.expiresAt,
      accounts: activeWatches.map((watch) => ({
        accountEmail: watch.accountEmail,
        expiresAt: watch.expiresAt,
        historyId: watch.historyId,
      })),
    };
  } catch (error) {
    console.error("Check watch status failed:", error);
    return { isActive: false, accounts: [] };
  }
}
