import { useEffect, useState } from "react";
import { DashboardStats, getStatsAction } from "../actions/dashboard";

export function useStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalEmailsProcessed: 0,
    activeCategories: 0,
    connectedAccounts: 0,
  });

  async function fetchStats() {
    const response = await getStatsAction();
    setStats(response);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    ...stats,
    isLoading,
  };
}
