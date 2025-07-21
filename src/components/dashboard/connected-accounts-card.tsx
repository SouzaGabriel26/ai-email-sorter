"use client";

import { ConnectedAccount } from "@/app/actions/accounts";
import { useConnectedAccounts } from "@/app/hooks/useConnectedAccounts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Mail,
  MoreVertical,
  Pause,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { Session } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";

interface ConnectedAccountsCardProps {
  session: Session;
  connectedAccounts?: number; // For backward compatibility
  isLoading?: boolean; // For backward compatibility
}

export function ConnectedAccountsCard({ session }: ConnectedAccountsCardProps) {
  const {
    accounts,
    isLoading,
    isDisconnecting,
    isSettingUpWatch,
    isStoppingWatch,
    isConnecting,
    disconnectAccount,
    setupWatch,
    stopWatch,
    connectAccount,
    refreshAccounts,
    totalActiveAccounts,
    totalMonitoredAccounts,
  } = useConnectedAccounts();

  const [showInactive, setShowInactive] = useState(false);

  const handleConnectAccount = async () => {
    const result = await connectAccount();

    if (!result.success) {
      toast.error("Failed to connect account", {
        description: result.error || "Please try again later",
      });
    }
    // Success case is handled by redirect in the hook
  };

  const handleDisconnectAccount = async (accountId: string, email: string) => {
    const result = await disconnectAccount(accountId);

    if (result.success) {
      toast.success("Account disconnected", {
        description: result.message,
      });
    } else {
      toast.error("Failed to disconnect account", {
        description: result.error,
      });
    }
  };

  const handleSetupWatch = async (accountId: string, email: string) => {
    const result = await setupWatch(accountId);

    if (result.success) {
      toast.success("Monitoring enabled", {
        description: result.message,
      });
    } else {
      toast.error("Failed to enable monitoring", {
        description: result.error,
      });
    }
  };

  const handleStopWatch = async (accountId: string, email: string) => {
    const result = await stopWatch(accountId);

    if (result.success) {
      toast.success("Monitoring stopped", {
        description: result.message,
      });
    } else {
      toast.error("Failed to stop monitoring", {
        description: result.error,
      });
    }
  };

  const getAccountInitials = (name: string, email: string) => {
    if (name && name !== "Gmail User" && name !== "Connection Error" && name !== "Token Expired") {
      return name.split(" ").map(n => n[0]).join("").toUpperCase();
    }
    return email.split("@")[0].slice(0, 2).toUpperCase();
  };

  const getAccountStatusColor = (account: ConnectedAccount) => {
    if (!account.isActive) return "destructive";
    if (account.hasActiveWatch) return "default";
    return "secondary";
  };

  const getAccountStatusIcon = (account: ConnectedAccount) => {
    if (!account.isActive) return <X className="h-3 w-3" />;
    if (account.hasActiveWatch) return <Wifi className="h-3 w-3" />;
    return <WifiOff className="h-3 w-3" />;
  };

  const getAccountStatusText = (account: ConnectedAccount) => {
    if (!account.isActive) return "Connection Error";
    if (account.hasActiveWatch) return "Monitored";
    return "Not Monitored";
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  const activeAccounts = accounts.filter(acc => acc.isActive);
  const inactiveAccounts = accounts.filter(acc => !acc.isActive);
  const totalEmails = accounts.reduce((sum, acc) => sum + (acc.totalEmails || 0), 0);

  return (
    <Card className="border-2 border-green-100 bg-gradient-to-br from-white to-green-50/30 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">Connected Accounts</CardTitle>
              <CardDescription className="text-gray-600">
                Manage Gmail accounts for AI email processing
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshAccounts}
            disabled={isLoading}
            className="shrink-0 hover:bg-green-100"
            aria-label="Refresh accounts"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats - Enhanced */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-green-100">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-lg font-bold text-green-600">
                {isLoading ? "..." : totalActiveAccounts}
              </span>
            </div>
            <p className="text-xs text-gray-600">Active</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Wifi className="h-4 w-4 text-blue-600 mr-1" />
              <span className="text-lg font-bold text-blue-600">
                {isLoading ? "..." : totalMonitoredAccounts}
              </span>
            </div>
            <p className="text-xs text-gray-600">Monitored</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Mail className="h-4 w-4 text-purple-600 mr-1" />
              <span className="text-lg font-bold text-purple-600">
                {isLoading ? "..." : totalEmails}
              </span>
            </div>
            <p className="text-xs text-gray-600">Emails</p>
          </div>
        </div>

        {/* Account List - Enhanced */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Loading accounts...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active Accounts - Enhanced */}
            {activeAccounts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Active Accounts ({activeAccounts.length})
                </h4>
                <div className="space-y-3">
                  {activeAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border border-green-200 rounded-lg hover:bg-green-50 transition-all duration-200 bg-white/50"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 shrink-0 border-2 border-green-200">
                          <AvatarImage src={account.image} alt={account.name} />
                          <AvatarFallback className="text-sm bg-green-100 text-green-700 font-medium">
                            {getAccountInitials(account.name, account.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {account.email}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge
                              variant={getAccountStatusColor(account)}
                              className="text-xs"
                            >
                              {getAccountStatusIcon(account)}
                              <span className="ml-1">{getAccountStatusText(account)}</span>
                            </Badge>
                            {account.totalEmails && account.totalEmails > 0 && (
                              <span className="text-xs text-gray-500">
                                {account.totalEmails} emails
                              </span>
                            )}
                          </div>
                          {account.lastSyncAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              Last sync: {formatRelativeTime(account.lastSyncAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {!account.hasActiveWatch && account.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetupWatch(account.id, account.email)}
                            disabled={isSettingUpWatch === account.id}
                            className="text-xs border-green-200 hover:bg-green-50"
                          >
                            <Activity className="h-3 w-3 mr-1" />
                            {isSettingUpWatch === account.id ? "Setting up..." : "Monitor"}
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDisconnectAccount(account.id, account.email)}
                              disabled={isDisconnecting === account.id}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {isDisconnecting === account.id ? "Disconnecting..." : "Disconnect"}
                            </DropdownMenuItem>
                            {account.hasActiveWatch && (
                              <DropdownMenuItem
                                onClick={() => handleStopWatch(account.id, account.email)}
                                disabled={isStoppingWatch === account.id}
                                className="text-yellow-600"
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                {isStoppingWatch === account.id ? "Stopping..." : "Stop Monitor"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Accounts - Enhanced */}
            {inactiveAccounts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
                    Inactive Accounts ({inactiveAccounts.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInactive(!showInactive)}
                    className="text-xs"
                  >
                    {showInactive ? "Hide" : "Show"}
                  </Button>
                </div>

                {showInactive && (
                  <div className="space-y-2">
                    {inactiveAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 border border-amber-200 bg-amber-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                              {getAccountInitials(account.name, account.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {account.email}
                            </p>
                            <p className="text-xs text-amber-600">{account.name}</p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnectAccount(account.id, account.email)}
                          disabled={isDisconnecting === account.id}
                          className="shrink-0 border-amber-200 hover:bg-amber-100"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {isDisconnecting === account.id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty State - Enhanced */}
            {accounts.length === 0 && !isLoading && (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Gmail Account</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Connect your Gmail account to start automatically processing and organizing your emails with AI.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Connect Account Button - Enhanced */}
        <div className="pt-4">
          <Button
            variant="outline"
            className="w-full border-green-200 hover:bg-green-50 text-green-700"
            onClick={handleConnectAccount}
            disabled={isConnecting || isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isConnecting ? "Connecting..." : "Connect Another Gmail Account"}
          </Button>
        </div>

        {/* Help Text - Enhanced */}
        <div className="text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            Connect multiple Gmail accounts to monitor and process emails from all your inboxes.
            <br />
            <span className="text-amber-600 font-medium">⚠️ Maximum 10 accounts per user</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 