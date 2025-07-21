import { useCallback, useEffect, useState } from "react";
import {
  EmailDetails,
  EmailWithCategory,
  getEmailDetailsAction,
  getEmailStatsAction,
  getEmailsAction,
  getEmailsByCategoryAction,
  searchEmailsAction,
} from "../actions/emails";

export interface EmailStats {
  totalEmails: number;
  categorizedEmails: number;
  uncategorizedEmails: number;
  categoriesCount: number;
  lastProcessedAt: Date | null;
}

export interface CategoryWithCount {
  id: string;
  name: string;
  description: string;
  _count: {
    emails: number;
  };
}

export function useEmails(categoryId?: string) {
  const [emails, setEmails] = useState<EmailWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const emailsList = await getEmailsAction(categoryId);
      setEmails(emailsList);
    } catch (error) {
      console.error("Error fetching emails:", error);
      setError("Failed to load emails");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return {
    emails,
    isLoading,
    error,
    refetch: fetchEmails,
  };
}

export function useEmailDetails(emailId: string | null) {
  const [emailDetails, setEmailDetails] = useState<EmailDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEmailDetails() {
      if (!emailId) {
        setEmailDetails(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const details = await getEmailDetailsAction(emailId);
        setEmailDetails(details);
      } catch (error) {
        console.error("Error fetching email details:", error);
        setError("Failed to load email details");
      } finally {
        setIsLoading(false);
      }
    }

    fetchEmailDetails();
  }, [emailId]);

  return {
    emailDetails,
    isLoading,
    error,
  };
}

export function useEmailStats() {
  const [stats, setStats] = useState<EmailStats>({
    totalEmails: 0,
    categorizedEmails: 0,
    uncategorizedEmails: 0,
    categoriesCount: 0,
    lastProcessedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    try {
      setIsLoading(true);
      setError(null);
      const emailStats = await getEmailStatsAction();
      setStats(emailStats);
    } catch (error) {
      console.error("Error fetching email stats:", error);
      setError("Failed to load email statistics");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}

export function useEmailsByCategory() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchCategories() {
    try {
      setIsLoading(true);
      setError(null);
      const categoriesList = await getEmailsByCategoryAction();
      setCategories(categoriesList);
    } catch (error) {
      console.error("Error fetching categories with email counts:", error);
      setError("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
  };
}

export function useEmailSearch() {
  const [searchResults, setSearchResults] = useState<EmailWithCategory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchEmails = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);
      const results = await searchEmailsAction(query.trim());
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching emails:", error);
      setSearchError("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    searchEmails,
    clearSearch,
  };
}
