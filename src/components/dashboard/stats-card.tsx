"use client";

import { EmailStats } from "@/app/hooks/useEmails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Archive, Bot, FolderOpen, Mail, TrendingUp } from "lucide-react";

interface StatsCardProps {
  stats: EmailStats;
  isLoading: boolean;
}

export function StatsCard({ stats, isLoading }: StatsCardProps) {
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
    },
    {
      title: "Categorized",
      value: stats.categorizedEmails,
      icon: Bot,
      color: "text-green-600",
      bgColor: "bg-green-50",
      subtitle: `${categorizedPercentage}% success rate`,
    },
    {
      title: "Uncategorized",
      value: stats.uncategorizedEmails,
      icon: FolderOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Categories",
      value: stats.categoriesCount,
      icon: Archive,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>AI Email Processing Stats</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center p-4 border rounded-lg">
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>AI Email Processing Stats</span>
        </CardTitle>
        {stats.lastProcessedAt && (
          <p className="text-sm text-gray-500">
            Last processed: {new Date(stats.lastProcessedAt).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {stats.totalEmails === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No emails processed yet</h3>
            <p className="text-gray-500">
              Send yourself a test email to see AI categorization in action!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div key={index} className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className={cn("w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center", item.bgColor)}>
                      <IconComponent className={cn("h-4 w-4", item.color)} />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                    <div className="text-sm text-gray-600">{item.title}</div>
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

            {categorizedPercentage < 50 && stats.categoriesCount > 0 && stats.totalEmails > 5 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    Improve categorization accuracy
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  Consider adding more specific category descriptions or creating additional categories for better AI matching.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 