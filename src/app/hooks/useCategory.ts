import { useEffect, useState } from "react";
import { Category } from "../actions/categories";
import { EmailWithCategory, getEmailsAction } from "../actions/emails";

export function useCategory(categoryId: string) {
  const [category, setCategory] = useState<Category | null>(null);
  const [emails, setEmails] = useState<EmailWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchCategoryData() {
    try {
      setIsLoading(true);
      setError(null);

      if (categoryId === "uncategorized") {
        // Pseudo-category for uncategorized emails
        const uncategorizedCategory: Category = {
          id: "uncategorized",
          name: "Uncategorized",
          description: "Emails that could not be categorized by AI",
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { emails: 0 },
        };
        setCategory(uncategorizedCategory);
        const emailsData = await getEmailsAction("uncategorized");
        setEmails(emailsData);
        return;
      }

      // Import the action dynamically to avoid server/client issues
      const { getCategoryByIdAction } = await import("../actions/categories");

      // Fetch category details
      const categoryData = await getCategoryByIdAction(categoryId);
      if (!categoryData) {
        setError("Category not found");
        return;
      }
      setCategory(categoryData);

      // Fetch emails for this category
      const emailsData = await getEmailsAction(categoryId);
      setEmails(emailsData);
    } catch (err) {
      console.error("Error fetching category data:", err);
      setError("Failed to load category data");
    } finally {
      setIsLoading(false);
    }
  }

  async function refetch() {
    await fetchCategoryData();
  }

  useEffect(() => {
    if (categoryId) {
      fetchCategoryData();
    }
  }, [categoryId]);

  return {
    category,
    emails,
    isLoading,
    error,
    refetch,
  };
}
