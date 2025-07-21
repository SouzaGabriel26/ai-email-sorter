import { EmailContent } from "./ai.service";

export interface UnsubscribeLink {
  url: string;
  text: string;
  type: "link" | "button" | "email";
  confidence: number;
}

export class UnsubscribeService {
  /**
   * Find unsubscribe links in the email content (HTML and text).
   * Uses regex and simple heuristics. Can be extended with AI later.
   */
  async findUnsubscribeLinks(
    emailContent: EmailContent
  ): Promise<UnsubscribeLink[]> {
    const links: UnsubscribeLink[] = [];
    const html = emailContent.bodyHtml || "";
    const text = emailContent.bodyText || "";

    // 1. Look for <a> tags with 'unsubscribe' in the text or href
    const anchorRegex = /<a [^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html))) {
      const href = match[1];
      const linkText = match[2];
      if (/unsubscribe/i.test(linkText) || /unsubscribe/i.test(href)) {
        links.push({
          url: href,
          text: linkText,
          type: "link",
          confidence: 0.95,
        });
      }
    }

    // 2. Look for mailto: unsubscribe addresses
    const mailtoRegex = /mailto:([^"'\s>]+)/gi;
    while ((match = mailtoRegex.exec(html + text))) {
      if (/unsubscribe/i.test(match[1])) {
        links.push({
          url: `mailto:${match[1]}`,
          text: "Unsubscribe Email",
          type: "email",
          confidence: 0.8,
        });
      }
    }

    // 3. Look for plain URLs in text with 'unsubscribe'
    const urlRegex = /(https?:\/\/[^\s"'>]+unsubscribe[^\s"'>]*)/gi;
    while ((match = urlRegex.exec(text))) {
      links.push({
        url: match[1],
        text: "Unsubscribe Link",
        type: "link",
        confidence: 0.7,
      });
    }

    // 4. Remove duplicates by URL
    const uniqueLinks = links.filter(
      (l, i, arr) => arr.findIndex((x) => x.url === l.url) === i
    );
    return uniqueLinks;
  }
}

export const unsubscribeService = new UnsubscribeService();
