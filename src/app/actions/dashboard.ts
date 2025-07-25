"use server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export type DashboardStats = {
  totalEmailsProcessed: number;
  connectedAccounts: number;
};

export async function getStatsAction(): Promise<DashboardStats> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return {
        totalEmailsProcessed: 0,
        connectedAccounts: 0,
      };
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
    });

    if (!user) {
      return {
        totalEmailsProcessed: 0,
        connectedAccounts: 0,
      };
    }

    const [totalEmailsProcessed, connectedAccounts] = await Promise.all([
      prisma.email.count({ where: { userId: user.id } }),
      prisma.account.count({ where: { userId: user.id } }),
    ]);

    return {
      totalEmailsProcessed,
      connectedAccounts,
    };
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return {
      totalEmailsProcessed: 0,
      connectedAccounts: 0,
    };
  }
}
