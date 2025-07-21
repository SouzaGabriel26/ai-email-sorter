"use client";

import { EmailWithCategory } from "@/app/actions/emails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Archive,
  Calendar,
  CheckSquare,
  Clock,
  ExternalLink,
  Mail,
  Square
} from "lucide-react";

interface EmailListProps {
  emails: EmailWithCategory[];
  selectedEmails: Set<string>;
  onEmailSelect: (emailId: string, selected: boolean) => void;
  onEmailClick: (email: EmailWithCategory) => void;
  isLoading: boolean;
}

export function EmailList({
  emails,
  selectedEmails,
  onEmailSelect,
  onEmailClick,
  isLoading,
}: EmailListProps) {
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

  const getSenderInitials = (name: string | null, email: string) => {
    if (name && name !== "Unknown") {
      return name.split(" ").map(n => n[0]).join("").toUpperCase();
    }
    return email.split("@")[0].slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading emails...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Emails Found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              This category doesn&apos;t have any emails yet. Emails will appear here once they&apos;re processed by AI.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg">
      <CardContent className="p-6">
        <div className="space-y-3">
          {emails.map((email) => {
            const isSelected = selectedEmails.has(email.id);

            return (
              <div
                key={email.id}
                className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer ${isSelected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                onClick={() => onEmailClick(email)}
              >
                <div className="flex items-start space-x-3">
                  {/* Selection Button */}
                  <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEmailSelect(email.id, !isSelected)}
                      className={`h-6 w-6 p-0 ${isSelected
                        ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-blue-700">
                            {getSenderInitials(email.fromName, email.fromEmail)}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {email.fromName || email.fromEmail}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {email.fromEmail}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatRelativeTime(email.receivedAt)}
                        </span>
                        {email.isArchived && (
                          <Badge variant="secondary" className="text-xs">
                            <Archive className="h-3 w-3 mr-1" />
                            Archived
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Subject */}
                    <h3 className="text-base font-medium text-gray-900 mb-2 line-clamp-1">
                      {email.subject}
                    </h3>

                    {/* AI Summary */}
                    {email.aiSummary && (
                      <div className="mb-3">
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {email.aiSummary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {email.receivedAt.toLocaleDateString()}
                        </span>
                        {email.processedAt && (
                          <span className="flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            Processed {formatRelativeTime(email.processedAt)}
                          </span>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEmailClick(email);
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Stats */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {emails.length} email{emails.length !== 1 ? 's' : ''}
            </span>
            <span>
              {selectedEmails.size} selected
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 