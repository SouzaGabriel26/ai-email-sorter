import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { GenerativeModel } from "@google/generative-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { UnsubscribeLink } from "./unsubscribe.service";

export interface EmailClassificationResult {
  categoryId: string | null;
  categoryName: string | null;
  summary: string;
  confidence: number;
  reasoning?: string;
}

export interface CategoryContext {
  id: string;
  name: string;
  description: string;
}

export interface EmailContent {
  subject: string;
  fromEmail: string;
  fromName?: string;
  bodyText?: string;
  bodyHtml?: string;
}

export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    }

    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    // Using Gemini 2.5 Pro - the latest and most capable model
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent categorization
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });
  }

  async categorizeAndSummarizeEmail(
    emailContent: EmailContent,
    userId: string
  ): Promise<EmailClassificationResult> {
    try {
      // Step 1: Get user's categories with validation
      const categories = await this.getUserCategories(userId);

      if (categories.length === 0) {
        logger.warn("No categories found for user", { userId });
        return {
          categoryId: null,
          categoryName: null,
          summary: await this.generateSummary(emailContent),
          confidence: 0,
          reasoning: "No categories available for classification",
        };
      }

      // Step 2: Prepare email content for AI analysis
      const emailText = this.prepareEmailContent(emailContent);

      // Step 3: Build categorization prompt
      const prompt = this.buildCategorizationPrompt(emailText, categories);

      // Step 4: Call Gemini for categorization and summarization
      let text: string = "";
      let parseError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await this.model.generateContent(prompt);
          const response = result.response;
          text = response.text();
          logger.debug("AI categorization response", {
            userId,
            subject: emailContent.subject,
            responseLength: text.length,
            responseText: text.substring(0, 500),
            attempt,
          });
          // Try to parse
          return await this.parseAIResponse(text, categories);
        } catch (err) {
          parseError = err instanceof Error ? err : new Error(String(err));
          logger.warn("AI categorization parse attempt failed", {
            userId,
            subject: emailContent.subject,
            attempt,
            error: parseError.message,
            responseText: text.substring(0, 500),
          });
        }
      }
      // If both attempts fail, fallback
      logger.error("AI categorization failed after retries", {
        userId,
        subject: emailContent.subject,
        error: parseError ? parseError.message : "Unknown error",
        lastResponse: text.substring(0, 500),
      });
      // Fallback: provide summary without categorization
      try {
        const summary = await this.generateSummary(emailContent);
        return {
          categoryId: null,
          categoryName: null,
          summary,
          confidence: 0,
          reasoning: "Categorization failed, summary only",
        };
      } catch {
        logger.error("Fallback summary generation failed", {
          userId,
          subject: emailContent.subject,
        });
        return {
          categoryId: null,
          categoryName: null,
          summary: `Email from ${emailContent.fromEmail} about: ${emailContent.subject}`,
          confidence: 0,
          reasoning: "AI processing failed, using basic summary",
        };
      }
    } catch (error) {
      logger.error("AI categorization failed (outer catch)", {
        userId,
        subject: emailContent.subject,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback: provide summary without categorization
      try {
        const summary = await this.generateSummary(emailContent);
        return {
          categoryId: null,
          categoryName: null,
          summary,
          confidence: 0,
          reasoning: "Categorization failed, summary only (outer catch)",
        };
      } catch {
        logger.error("Fallback summary generation failed (outer catch)", {
          userId,
          subject: emailContent.subject,
        });
        return {
          categoryId: null,
          categoryName: null,
          summary: `Email from ${emailContent.fromEmail} about: ${emailContent.subject}`,
          confidence: 0,
          reasoning: "AI processing failed, using basic summary (outer catch)",
        };
      }
    }
  }

  private async getUserCategories(userId: string): Promise<CategoryContext[]> {
    const categories = await prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return categories;
  }

  private prepareEmailContent(emailContent: EmailContent): string {
    // Extract meaningful content from email
    const { subject, fromEmail, fromName, bodyText, bodyHtml } = emailContent;

    // Prefer plain text, fall back to HTML if needed
    let body = bodyText || bodyHtml || "";

    // If we only have HTML, strip basic tags for better analysis
    if (!bodyText && bodyHtml) {
      body = bodyHtml
        .replace(/<[^>]*>/g, " ") // Remove HTML tags
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
    }

    // Limit content length to avoid token limits (keep first 3000 chars)
    const maxBodyLength = 3000;
    if (body.length > maxBodyLength) {
      body = body.substring(0, maxBodyLength) + "... [truncated]";
    }

    return `
Subject: ${subject}
From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}

Email Content:
${body}
    `.trim();
  }

  private buildCategorizationPrompt(
    emailText: string,
    categories: CategoryContext[]
  ): string {
    const categoriesText = categories
      .map((cat) => `- ${cat.name}: ${cat.description}`)
      .join("\n");

    return `You are an expert email classifier. Analyze the following email and:

1. Choose the BEST matching category from the available options
2. Generate a concise, helpful summary (2-3 sentences max)
3. Provide a confidence score (0-100)

Available Categories:
${categoriesText}

Email to analyze:
${emailText}

Respond in this EXACT JSON format (no additional text):
{
  "categoryName": "exact_category_name_or_null",
  "summary": "clear_and_concise_summary",
  "confidence": confidence_score_0_to_100,
  "reasoning": "brief_explanation_of_choice"
}

Rules:
- Only use exact category names from the list above
- If no category fits well (confidence < 50), set categoryName to null
- Summary should be actionable and informative
- Confidence should reflect how well the email matches the category
- Keep reasoning brief (one sentence)`;
  }

  private async parseAIResponse(
    responseText: string,
    categories: CategoryContext[]
  ): Promise<EmailClassificationResult> {
    try {
      // Extract JSON from response (sometimes AI adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (typeof parsed.summary !== "string") {
        throw new Error("Invalid summary in AI response");
      }

      if (
        typeof parsed.confidence !== "number" ||
        parsed.confidence < 0 ||
        parsed.confidence > 100
      ) {
        throw new Error("Invalid confidence score in AI response");
      }

      // Find matching category
      let categoryId: string | null = null;
      let categoryName: string | null = null;

      if (parsed.categoryName && typeof parsed.categoryName === "string") {
        const matchingCategory = categories.find(
          (cat) => cat.name.toLowerCase() === parsed.categoryName.toLowerCase()
        );

        if (matchingCategory) {
          categoryId = matchingCategory.id;
          categoryName = matchingCategory.name;
        } else {
          logger.warn("AI suggested non-existent category", {
            suggested: parsed.categoryName,
            availableCategories: categories.map((c) => c.name).join(", "),
          });
        }
      }

      return {
        categoryId,
        categoryName,
        summary: parsed.summary.trim(),
        confidence: Math.round(parsed.confidence),
        reasoning: parsed.reasoning || "No reasoning provided",
      };
    } catch (error) {
      logger.error("Failed to parse AI response", {
        responseText: responseText.substring(0, 500),
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error("Failed to parse AI categorization response");
    }
  }

  private async generateSummary(emailContent: EmailContent): Promise<string> {
    try {
      const emailText = this.prepareEmailContent(emailContent);

      const prompt = `Summarize this email in 2-3 clear, actionable sentences. Focus on the main purpose and any required actions.

Email:
${emailText}

Summary:`;

      const result = await this.model.generateContent(prompt);
      const summary = result.response.text().trim();

      // Ensure summary isn't too long
      if (summary.length > 300) {
        return summary.substring(0, 297) + "...";
      }

      return summary;
    } catch (error) {
      logger.error("Summary generation failed", {
        subject: emailContent.subject,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to basic summary
      return `Email from ${emailContent.fromEmail} regarding: ${emailContent.subject}`;
    }
  }

  /**
   * Use Gemini to analyze email content for unsubscribe links (AI fallback).
   */
  async analyzeUnsubscribeLinks(
    emailContent: EmailContent
  ): Promise<UnsubscribeLink[]> {
    const prompt = `Find all unsubscribe links in the following email. Return a JSON array of objects with { url, text, type, confidence } for each link. Type is one of 'link', 'button', or 'email'. Only include real unsubscribe options.\n\nEmail HTML:\n${
      emailContent.bodyHtml || ""
    }\n\nEmail Text:\n${emailContent.bodyText || ""}`;
    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    try {
      // Use a compatible regex for JSON array extraction
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const links = JSON.parse(jsonMatch[0]);
      if (Array.isArray(links)) {
        return links
          .filter((l) => l.url)
          .map((l) => ({
            url: l.url,
            text: l.text || "Unsubscribe",
            type: l.type || "link",
            confidence: typeof l.confidence === "number" ? l.confidence : 0.7,
          }));
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Use Gemini to analyze an unsubscribe page and return actions to automate.
   */
  async analyzeUnsubscribePage(
    pageHtml: string,
    pageUrl: string,
    userEmail: string
  ): Promise<{ type: string; selector: string; value?: string }[]> {
    const prompt = `You are an AI agent helping a user unsubscribe from emails. Given the HTML of an unsubscribe web page, return a JSON array of actions to perform in order to complete the unsubscribe process.\n\nEach action should be an object with { type, selector, value? }.\n- type: 'click', 'fill', or 'select'.\n- selector: a CSS selector for the element.\n- value: (for 'fill' or 'select') the value to use.\n\nThe user's email is: ${userEmail}\n\nPage URL: ${pageUrl}\n\nPage HTML:\n${pageHtml.substring(
      0,
      4000
    )}\n\nRespond ONLY with the JSON array.`;
    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    try {
      // Use a compatible regex for JSON array extraction
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const actions = JSON.parse(jsonMatch[0]);
      if (Array.isArray(actions)) {
        return actions.filter((a) => a.type && a.selector);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Validate that user has at least one category before processing emails
   */
  async validateUserHasCategories(userId: string): Promise<boolean> {
    const categoryCount = await prisma.category.count({
      where: { userId },
    });

    return categoryCount > 0;
  }

  /**
   * Get statistics about AI processing accuracy (for monitoring)
   */
  async getProcessingStats(
    userId: string,
    days: number = 7
  ): Promise<{
    totalProcessed: number;
    categorized: number;
    uncategorized: number;
    averageConfidence: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const emails = await prisma.email.findMany({
      where: {
        userId,
        processedAt: { gte: since },
        aiSummary: { not: null },
      },
      select: {
        categoryId: true,
        // Note: We don't store confidence in the schema, this is for future enhancement
      },
    });

    const totalProcessed = emails.length;
    const categorized = emails.filter((e) => e.categoryId !== null).length;
    const uncategorized = totalProcessed - categorized;

    return {
      totalProcessed,
      categorized,
      uncategorized,
      averageConfidence:
        categorized > 0 ? (categorized / totalProcessed) * 100 : 0,
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
