"use server";

import { prisma } from "@/lib/prisma";
import { browserService } from "@/services/browser.service";
import {
  UnsubscribeLink,
  unsubscribeService,
} from "@/services/unsubscribe.service";
import { revalidatePath } from "next/cache";

export async function unsubscribeFromEmailsAction(emailIds: string[]) {
  // 1. Get email details from database
  const emails = await prisma.email.findMany({
    where: { id: { in: emailIds } },
  });

  const results: { emailId: string; status: string; error?: string }[] = [];

  for (const email of emails) {
    try {
      // 2. Extract unsubscribe links (prefer stored, else parse)
      let links: UnsubscribeLink[] | undefined;
      if (email.unsubscribeLinks) {
        try {
          links = Array.isArray(email.unsubscribeLinks)
            ? (email.unsubscribeLinks as unknown as UnsubscribeLink[])
            : JSON.parse(email.unsubscribeLinks as unknown as string);
        } catch {
          links = undefined;
        }
      }
      if (!links || links.length === 0) {
        const content = {
          subject: email.subject,
          fromEmail: email.fromEmail,
          fromName: email.fromName || undefined,
          bodyText: email.bodyText || undefined,
          bodyHtml: email.bodyHtml || undefined,
        };
        links = await unsubscribeService.findUnsubscribeLinks(content);
        // Store in DB for future
        await prisma.email.update({
          where: { id: email.id },
          data: {
            unsubscribeLinks: JSON.stringify(links),
            unsubscribeStatus: links.length ? "pending" : "no_links_found",
          },
        });
      }
      if (!links || links.length === 0) {
        results.push({ emailId: email.id, status: "no_links_found" });
        continue;
      }
      // 3. Mark as processing
      await prisma.email.update({
        where: { id: email.id },
        data: {
          unsubscribeStatus: "processing",
          unsubscribeAttemptedAt: new Date(),
        },
      });
      // 4. For each link, try to unsubscribe (stop at first success)
      let unsubscribed = false;
      let lastError = "";
      for (const link of links) {
        const result = await browserService.unsubscribeFromLink(
          link,
          email.toEmail
        );
        if (result.success) {
          unsubscribed = true;
          await prisma.email.update({
            where: { id: email.id },
            data: {
              unsubscribeStatus: "completed",
              unsubscribeCompletedAt: new Date(),
              unsubscribeError: null,
            },
          });
          results.push({ emailId: email.id, status: "completed" });
          break;
        } else {
          lastError = result.error || "Unknown error";
        }
      }
      if (!unsubscribed) {
        await prisma.email.update({
          where: { id: email.id },
          data: { unsubscribeStatus: "failed", unsubscribeError: lastError },
        });
        results.push({ emailId: email.id, status: "failed", error: lastError });
      }
    } catch (error) {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          unsubscribeStatus: "failed",
          unsubscribeError:
            error instanceof Error ? error.message : String(error),
        },
      });
      results.push({
        emailId: email.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  // Revalidate affected pages
  revalidatePath("/dashboard", "page");
  return results;
}
