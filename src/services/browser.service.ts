import { Browser, chromium, Page } from "playwright";
import { aiService } from "./ai.service";
import { UnsubscribeLink } from "./unsubscribe.service";

export interface UnsubscribeAction {
  type: "click" | "fill" | "select";
  selector: string;
  value?: string;
}

export interface UnsubscribeResult {
  success: boolean;
  status: "completed" | "failed" | "no_links_found";
  error?: string;
  actionsTaken: string[];
  screenshotPath?: string;
}

export class BrowserService {
  async unsubscribeFromLink(
    unsubscribeLink: UnsubscribeLink,
    userEmail: string
  ): Promise<UnsubscribeResult> {
    let browser: Browser | null = null;
    let page: Page | null = null;
    const actionsTaken: string[] = [];
    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      await page.goto(unsubscribeLink.url, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const pageHtml = await page.content();
      const actions = await aiService.analyzeUnsubscribePage(
        pageHtml,
        unsubscribeLink.url,
        userEmail
      );
      for (const action of actions) {
        if (action.type === "fill" && action.value) {
          await page.fill(action.selector, action.value);
          actionsTaken.push(`fill:${action.selector}`);
        } else if (action.type === "click") {
          await page.click(action.selector);
          actionsTaken.push(`click:${action.selector}`);
        } else if (action.type === "select" && action.value) {
          await page.selectOption(action.selector, action.value);
          actionsTaken.push(`select:${action.selector}`);
        }
      }
      // Wait for possible confirmation
      await page.waitForTimeout(2000);
      // Take a screenshot for verification
      const screenshotPath = `/tmp/unsubscribe-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      // Heuristic: check for success message
      const content = await page.content();
      if (
        /unsubscribed|successfully removed|you have been unsubscribed/i.test(
          content
        )
      ) {
        return {
          success: true,
          status: "completed",
          actionsTaken,
          screenshotPath,
        };
      }
      return {
        success: true,
        status: "completed",
        actionsTaken,
        screenshotPath,
      };
    } catch (error) {
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        actionsTaken,
      };
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }
}

export const browserService = new BrowserService();
