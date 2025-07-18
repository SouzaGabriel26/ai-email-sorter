import { useEffect, useState } from "react";
import {
  Category,
  createCategoryAction,
  getCategoriesAction,
} from "../actions/categories";
import { CreateCategoryInput } from "../schemas/category";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  async function fetchCategories() {
    try {
      setIsLoading(true);
      const categoriesList = await getCategoriesAction();
      setCategories(categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createCategory(input: CreateCategoryInput) {
    try {
      setIsCreating(true);
      const result = await createCategoryAction(input);

      if (result.success) {
        await fetchCategories();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error creating category:", error);
      return {
        success: false,
        error: "Failed to create category. Please try again.",
      };
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    isLoading,
    isCreating,
    createCategory,
  };
}
