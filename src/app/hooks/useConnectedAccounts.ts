import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  connectAccountAction,
  disconnectAccountAction,
  getConnectedAccountsAction,
  setupWatchForAccountAction,
  stopWatchForAccountAction,
  type ConnectedAccount,
} from "../actions/accounts";

interface UseConnectedAccountsReturn {
  accounts: ConnectedAccount[];
  isLoading: boolean;
  isDisconnecting: string | null;
  isSettingUpWatch: string | null;
  isStoppingWatch: string | null;
  isConnecting: boolean;
  fetchAccounts: () => Promise<void>;
  disconnectAccount: (accountId: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  setupWatch: (accountId: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  stopWatch: (accountId: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  connectAccount: () => Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }>;
  refreshAccounts: () => Promise<void>;
  totalActiveAccounts: number;
  totalMonitoredAccounts: number;
}

export function useConnectedAccounts(): UseConnectedAccountsReturn {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);
  const [isSettingUpWatch, setIsSettingUpWatch] = useState<string | null>(null);
  const [isStoppingWatch, setIsStoppingWatch] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getConnectedAccountsAction();
      if (response.success && response.accounts) {
        setAccounts(response.accounts);
      } else {
        console.error("Failed to fetch accounts:", response.error);
        setAccounts([]);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectAccount = useCallback(async (accountId: string) => {
    try {
      setIsDisconnecting(accountId);
      const response = await disconnectAccountAction(accountId);

      if (response.success) {
        // Remove the account from local state
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
        return { success: true, message: response.message };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error("Error disconnecting account:", error);
      return { success: false, error: "Failed to disconnect account" };
    } finally {
      setIsDisconnecting(null);
    }
  }, []);

  const setupWatch = useCallback(async (accountId: string) => {
    try {
      setIsSettingUpWatch(accountId);
      const response = await setupWatchForAccountAction(accountId);

      if (response.success) {
        // Update the account in local state
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.id === accountId
              ? {
                  ...acc,
                  hasActiveWatch: true,
                  watchExpiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000
                  ),
                }
              : acc
          )
        );
        return { success: true, message: response.message };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error("Error setting up watch:", error);
      return { success: false, error: "Failed to enable monitoring" };
    } finally {
      setIsSettingUpWatch(null);
    }
  }, []);

  const stopWatch = useCallback(async (accountId: string) => {
    try {
      setIsStoppingWatch(accountId);
      const response = await stopWatchForAccountAction(accountId);

      if (response.success) {
        // Update the account in local state
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.id === accountId
              ? {
                  ...acc,
                  hasActiveWatch: false,
                  watchExpiresAt: undefined,
                }
              : acc
          )
        );
        return { success: true, message: response.message };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error("Error stopping watch:", error);
      return { success: false, error: "Failed to stop monitoring" };
    } finally {
      setIsStoppingWatch(null);
    }
  }, []);

  const connectAccount = useCallback(async () => {
    try {
      setIsConnecting(true);
      const response = await connectAccountAction();

      if (response.success) {
        // Use NextAuth signIn to connect additional account
        // The auth config now includes "select_account" which will show account picker
        await signIn("google", {
          callbackUrl: `${window.location.origin}/dashboard?success=account-connected`,
        });
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error("Error connecting account:", error);
      return { success: false, error: "Failed to connect account" };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    await fetchAccounts();
  }, [fetchAccounts]);

  // Computed values
  const totalActiveAccounts = accounts.filter((acc) => acc.isActive).length;
  const totalMonitoredAccounts = accounts.filter(
    (acc) => acc.hasActiveWatch
  ).length;

  // Initial load
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Refresh accounts every 5 minutes to sync status
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        !isLoading &&
        !isDisconnecting &&
        !isSettingUpWatch &&
        !isStoppingWatch &&
        !isConnecting
      ) {
        fetchAccounts();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [
    fetchAccounts,
    isLoading,
    isDisconnecting,
    isSettingUpWatch,
    isStoppingWatch,
    isConnecting,
  ]);

  return {
    accounts,
    isLoading,
    isDisconnecting,
    isSettingUpWatch,
    isStoppingWatch,
    isConnecting,
    fetchAccounts,
    disconnectAccount,
    setupWatch,
    stopWatch,
    connectAccount,
    refreshAccounts,
    totalActiveAccounts,
    totalMonitoredAccounts,
  };
}
