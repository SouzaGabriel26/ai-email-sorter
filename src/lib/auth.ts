import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { setupGmailWatchForUser } from "./gmail-utils";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          access_type: "offline",
          prompt: "consent select_account",
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile: _profile }) {
      // Only set up Gmail watch if this is an explicit account connection
      // Not on regular sign-ins to prevent unnecessary watch creation
      if (account?.provider === "google" && account.access_token) {
        try {
          // Check if this is a new account connection vs regular sign-in
          // We can detect this by checking if the user already exists
          let dbUser;

          if (user.email) {
            dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              include: {
                accounts: {
                  where: { provider: "google" },
                  select: { id: true },
                },
              },
            });
          }

          // Skip auto-watch setup for:
          // 1. New users (let them set up manually)
          // 2. Existing users with accounts (prevent duplicate setups)
          if (!dbUser) {
            console.log("New user sign-up - skipping auto Gmail watch setup");
            return true;
          }

          // Check if this is adding a new account vs re-authenticating existing
          const existingAccountCount = dbUser.accounts.length;

          // Only auto-setup for the very first Google account connection
          // All subsequent accounts should be set up manually via UI
          if (existingAccountCount === 0) {
            console.log(
              "First Google account connection - setting up Gmail watch"
            );

            const result = await setupGmailWatchForUser(
              dbUser.id,
              account.access_token,
              account.refresh_token
            );

            if (result.success) {
              console.log("Auto-monitoring set up:", result.message);
            } else {
              console.warn("Auto-monitoring setup failed:", result.error);
            }
          } else {
            console.log(
              `User has ${existingAccountCount} existing accounts - skipping auto watch setup`
            );
          }
        } catch (error) {
          console.error("Error in sign-in callback:", error);
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  events: {
    async linkAccount({ user, account, profile }) {
      console.log(`Account linked: ${account.provider} for user ${user.id}`);

      // Additional logging for debugging
      if (account.provider === "google" && profile?.email) {
        console.log(`Gmail account ${profile.email} linked to user ${user.id}`);
      }
    },
  },
};
