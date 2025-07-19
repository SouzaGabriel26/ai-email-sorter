import { useEffect, useState } from "react";
import {
  getGmailWatchStatusAction,
  startGmailWatchAction,
  stopGmailWatchAction,
} from "../actions/gmail";

interface GmailWatchStatus {
  isActive: boolean;
  activeWatches?: number;
  totalAccounts?: number;
  expiresAt?: Date;
  accounts?: Array<{
    accountEmail: string;
    expiresAt: Date;
    historyId: string;
  }>;
  error?: string;
}

export function useGmailWatch() {
  const [watchStatus, setWatchStatus] = useState<GmailWatchStatus>({
    isActive: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  async function fetchWatchStatus() {
    try {
      setIsLoading(true);
      const status = await getGmailWatchStatusAction();
      setWatchStatus(status);
    } catch (error) {
      console.error("Error fetching Gmail watch status:", error);
      setWatchStatus({
        isActive: false,
        error: "Failed to check status",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function startWatch() {
    try {
      setIsStarting(true);
      const result = await startGmailWatchAction();

      if (!result.success && result.accounts && result.accounts.length === 0) {
        console.error(
          "All accounts failed to start watching. Check server logs for detailed errors."
        );
      }

      if (result.success) {
        await fetchWatchStatus(); // Refresh status
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error starting Gmail watch:", error);
      return {
        success: false,
        error: "Failed to start Gmail watch. Please try again.",
      };
    } finally {
      setIsStarting(false);
    }
  }

  async function stopWatch() {
    try {
      setIsStopping(true);
      const result = await stopGmailWatchAction();

      if (result.success) {
        await fetchWatchStatus(); // Refresh status
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error stopping Gmail watch:", error);
      return {
        success: false,
        error: "Failed to stop Gmail watch. Please try again.",
      };
    } finally {
      setIsStopping(false);
    }
  }

  useEffect(() => {
    fetchWatchStatus();
  }, []);

  return {
    watchStatus,
    isLoading,
    isStarting,
    isStopping,
    startWatch,
    stopWatch,
    refreshStatus: fetchWatchStatus,
  };
}
