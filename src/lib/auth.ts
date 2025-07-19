import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { google } from "googleapis";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", // JWT sessions with database user storage
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
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
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
      // Send properties to the client
      if (token) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
    async signIn({ account, profile }) {
      // Auto-start Gmail monitoring for new accounts
      if (
        account?.provider === "google" &&
        account.access_token &&
        profile?.email
      ) {
        try {
          console.log(`🚀 Auto-starting Gmail watch for ${profile.email}`);

          // Check if watch already exists
          const existingWatch = await prisma.gmailWatch.findFirst({
            where: {
              accountEmail: profile.email,
              isActive: true,
              expiresAt: { gt: new Date() },
            },
          });

          if (existingWatch) {
            console.log(`⏭️ Gmail watch already active for ${profile.email}`);
            return true;
          }

          // Set up Gmail watch
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );

          oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          });

          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-inbox-changes-ai-email-sorter`;

          const response = await gmail.users.watch({
            userId: "me",
            requestBody: {
              labelIds: ["INBOX"],
              topicName,
            },
          });

          if (response.data.historyId && response.data.expiration) {
            // Find or create user
            const user = await prisma.user.findUnique({
              where: { email: profile.email },
            });

            if (user) {
              await prisma.gmailWatch.upsert({
                where: {
                  userId_accountEmail: {
                    userId: user.id,
                    accountEmail: profile.email,
                  },
                },
                update: {
                  userId: user.id,
                  accountEmail: profile.email,
                  historyId: response.data.historyId,
                  topicName,
                  expiresAt: new Date(parseInt(response.data.expiration)),
                  isActive: true,
                },
                create: {
                  userId: user.id,
                  accountEmail: profile.email,
                  historyId: response.data.historyId,
                  topicName,
                  expiresAt: new Date(parseInt(response.data.expiration)),
                  isActive: true,
                },
              });
              console.log(`✅ Auto-started Gmail watch for ${profile.email}`);
            }
          }
        } catch (error) {
          console.error(
            `❌ Failed to auto-start Gmail watch for ${profile.email}:`,
            error
          );
          // Don't fail the sign-in process
        }
      }
      return true;
    },
  },
};
