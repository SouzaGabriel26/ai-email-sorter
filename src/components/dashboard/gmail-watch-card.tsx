"use client";

import { useGmailWatch } from "@/app/hooks/useGmailWatch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, Mail, RefreshCw, Settings, Wifi, WifiOff } from "lucide-react";

interface GmailWatchCardProps {
  onRefresh?: () => void;
}

export function GmailWatchCard({ onRefresh }: GmailWatchCardProps) {
  const {
    watchStatus,
    isLoading,
    startWatch,
    stopWatch,
    refreshStatus,
  } = useGmailWatch();

  const getStatusInfo = () => {
    if (!watchStatus.totalAccounts) {
      return "No accounts connected";
    }

    if (watchStatus.activeWatches === watchStatus.totalAccounts) {
      return `All ${watchStatus.totalAccounts} account${watchStatus.totalAccounts > 1 ? 's' : ''} monitored`;
    }

    if (watchStatus.activeWatches && watchStatus.activeWatches > 0) {
      return `${watchStatus.activeWatches}/${watchStatus.totalAccounts} accounts monitored`;
    }

    return `${watchStatus.totalAccounts} account${watchStatus.totalAccounts > 1 ? 's' : ''} connected, not monitored`;
  };

  const getStatusColor = () => {
    if (watchStatus.activeWatches === watchStatus.totalAccounts && watchStatus.totalAccounts && watchStatus.totalAccounts > 0) {
      return "bg-green-100 text-green-800 border-green-200";
    }
    if (watchStatus.activeWatches && watchStatus.activeWatches > 0) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const setupAllWatches = async () => {
    const result = await startWatch();
    // Handle result if needed
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    } else {
      await refreshStatus();
    }
  };

  return (
    <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Mail className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">Gmail Monitoring</CardTitle>
              <CardDescription className="text-gray-600">
                Monitor your Gmail accounts for new emails
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="shrink-0 hover:bg-gray-100"
              aria-label="Refresh monitoring status"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge
              variant={watchStatus.isActive ? "default" : "secondary"}
              className={getStatusColor()}
            >
              {isLoading ? "Checking..." : watchStatus.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Checking status...</p>
          </div>
        ) : (
          <>
            {/* Status Information - Compact */}
            <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-center mb-2">
                {watchStatus.isActive ? (
                  <Wifi className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <WifiOff className="h-5 w-5 text-gray-400 mr-2" />
                )}
                <p className="text-sm font-medium text-gray-900">
                  {getStatusInfo()}
                </p>
              </div>
              {watchStatus.expiresAt && (
                <p className="text-xs text-gray-500 flex items-center justify-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Expires: {new Date(watchStatus.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Account Details - Compact */}
            {watchStatus.accounts && watchStatus.accounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 flex items-center">
                  <Settings className="h-3 w-3 mr-1" />
                  Active Watches:
                </p>
                <div className="space-y-1">
                  {watchStatus.accounts.slice(0, 3).map((account: { accountEmail: string; expiresAt: Date; historyId: string }, index: number) => (
                    <div key={index} className="flex justify-between text-xs bg-green-50 p-2 rounded border border-green-100">
                      <span className="font-mono truncate">{account.accountEmail}</span>
                      <span className="text-gray-500 shrink-0">
                        {new Date(account.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {watchStatus.accounts.length > 3 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{watchStatus.accounts.length - 3} more accounts
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display - Compact */}
            {watchStatus.error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm">{watchStatus.error}</span>
              </div>
            )}

            {/* Action Buttons - Compact */}
            {watchStatus.totalAccounts && watchStatus.totalAccounts > 0 && watchStatus.activeWatches && watchStatus.activeWatches < watchStatus.totalAccounts && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setupAllWatches}
                  disabled={false}
                  className="w-full border-gray-200 hover:bg-gray-50"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Enable All Monitoring
                </Button>
              </div>
            )}

            {/* Help Text */}
            <div className="text-center">
              <p className="text-xs text-gray-500 leading-relaxed">
                Monitoring ensures new emails are automatically processed and categorized by AI.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 