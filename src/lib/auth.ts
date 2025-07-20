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
      if (account?.provider === "google" && account.access_token) {
        try {
          // For additional account connections, we need to find the existing user
          // The user.id from OAuth might not match our database user ID
          let dbUser;

          if (user.email) {
            dbUser = await prisma.user.findUnique({
              where: { email: user.email },
            });
          }

          // If no user found by email, this might be a new user
          if (!dbUser) {
            console.log(
              "No existing user found, skipping Gmail watch setup for new user"
            );
            return true;
          }

          // Set up Gmail watch for this account using the correct database user ID
          const result = await setupGmailWatchForUser(
            dbUser.id, // Use the actual database user ID
            account.access_token,
            account.refresh_token
          );

          if (result.success) {
            console.log("Auto-monitoring set up:", result.message);
          } else {
            console.warn("Auto-monitoring setup failed:", result.error);
          }
        } catch (error) {
          console.error("Error setting up auto-monitoring:", error);
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
