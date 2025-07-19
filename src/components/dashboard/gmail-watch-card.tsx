"use client";

import { testGmailConnectionAction } from "@/app/actions/gmail";
import { useGmailWatch } from "@/app/hooks/useGmailWatch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, Play, Square, TestTube } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function GmailWatchCard() {
  const {
    watchStatus,
    isLoading,
    isStarting,
    isStopping,
    startWatch,
    stopWatch,
  } = useGmailWatch();

  const [isTesting, setIsTesting] = useState(false);

  async function handleTestConnection() {
    try {
      setIsTesting(true);
      const result = await testGmailConnectionAction();

      if (result.success) {
        toast.success("Gmail connections tested!", {
          description: result.message,
        });
      } else {
        toast.error("Gmail connection failed", {
          description: result.error,
        });
      }
    } catch {
      toast.error("Connection test failed", {
        description: "Please try again or check your authentication.",
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleStartWatch() {
    const result = await startWatch();

    if (result.success) {
      toast.success("Gmail monitoring updated!", {
        description: result.message,
      });
    } else {
      toast.error("Failed to start Gmail monitoring", {
        description: result.error || "Please try again.",
      });
    }
  }

  async function handleStopWatch() {
    const result = await stopWatch();

    if (result.success) {
      toast.success("Gmail monitoring stopped", {
        description: result.message,
      });
    } else {
      toast.error("Failed to stop Gmail monitoring", {
        description: result.error || "Please try again.",
      });
    }
  }

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <CardTitle>Gmail Monitoring</CardTitle>
          </div>
          <Badge variant={watchStatus.isActive ? "default" : "secondary"}>
            {isLoading ? "Checking..." : watchStatus.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <CardDescription>
          Monitor your Gmail accounts for new emails to process automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Checking status...</p>
          </div>
        ) : (
          <>
            {/* Status Information */}
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">
                {getStatusInfo()}
              </p>
              {watchStatus.expiresAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Expires: {new Date(watchStatus.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Account Details */}
            {watchStatus.accounts && watchStatus.accounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Active Watches:</p>
                {watchStatus.accounts.map((account, index) => (
                  <div key={index} className="flex justify-between text-xs bg-green-50 p-2 rounded">
                    <span className="font-mono">{account.accountEmail}</span>
                    <span className="text-gray-500">
                      Expires {new Date(account.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Error Display */}
            {watchStatus.error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{watchStatus.error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {/* Test Connection Button */}
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || isStarting || isStopping}
              >
                <TestTube className="h-4 w-4 mr-2" />
                {isTesting ? "Testing..." : "Test"}
              </Button>

              {/* Start/Stop Monitoring Button */}
              {watchStatus.isActive ? (
                <Button
                  variant="outline"
                  onClick={handleStopWatch}
                  disabled={isStopping || isStarting}
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  {isStopping ? "Stopping..." : "Stop All"}
                </Button>
              ) : (
                <Button
                  onClick={handleStartWatch}
                  disabled={isStarting || isStopping}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isStarting ? "Starting..." : "Start Monitoring"}
                </Button>
              )}
            </div>

            {/* Help Text */}
            {!watchStatus.isActive && watchStatus.totalAccounts && watchStatus.totalAccounts > 0 && (
              <p className="text-xs text-gray-500 text-center">
                {watchStatus.totalAccounts > 1
                  ? `Monitor all ${watchStatus.totalAccounts} connected Gmail accounts`
                  : "Monitor your Gmail account for new emails"
                }
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
} 