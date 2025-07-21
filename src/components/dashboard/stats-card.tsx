"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Archive, Bot, FolderOpen, Mail, RefreshCw, TrendingUp } from "lucide-react";

interface StatsCardProps {
  stats: {
    totalEmails: number;
    categorizedEmails: number;
    uncategorizedEmails: number;
    categoriesCount: number;
  };
  isLoading: boolean;
  onRefresh?: () => void;
}

export function StatsCard({ stats, isLoading, onRefresh }: StatsCardProps) {
  const categorizedPercentage = stats.totalEmails > 0
    ? Math.round((stats.categorizedEmails / stats.totalEmails) * 100)
    : 0;

  const statItems = [
    {
      title: "Total Emails",
      value: stats.totalEmails,
      icon: Mail,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100",
    },
    {
      title: "Categorized",
      value: stats.categorizedEmails,
      icon: Bot,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-100",
      subtitle: `${categorizedPercentage}% success rate`,
    },
    {
      title: "Uncategorized",
      value: stats.uncategorizedEmails,
      icon: FolderOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-100",
    },
    {
      title: "Categories",
      value: stats.categoriesCount,
      icon: Archive,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-100",
    },
  ];

  if (isLoading) {
    return (
      <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg h-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">AI Email Processing Stats</CardTitle>
                <CardDescription className="text-gray-600">
                  Real-time statistics of your email processing
                </CardDescription>
              </div>
            </div>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="shrink-0 hover:bg-gray-100"
                aria-label="Refresh stats"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center p-4 border border-gray-200 rounded-lg bg-white/50">
                <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded mb-1 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">AI Email Processing Stats</CardTitle>
              <CardDescription className="text-gray-600">
                Real-time statistics of your email processing
              </CardDescription>
            </div>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="shrink-0 hover:bg-gray-100"
              aria-label="Refresh stats"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div
                key={index}
                className={cn(
                  "text-center p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
                  item.bgColor,
                  item.borderColor
                )}
              >
                <div className={cn("w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center", item.bgColor)}>
                  <IconComponent className={cn("h-4 w-4", item.color)} />
                </div>
                <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                <div className="text-sm text-gray-600 font-medium">{item.title}</div>
                {item.subtitle && (
                  <div className="text-xs text-gray-500 mt-1">{item.subtitle}</div>
                )}
              </div>
            );
          })}
        </div>

        {stats.categoriesCount === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Create categories to enable AI email sorting
              </span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Add your first category to start automatically organizing incoming emails.
            </p>
          </div>
        )}

        {stats.totalEmails > 0 && (
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Activity className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 