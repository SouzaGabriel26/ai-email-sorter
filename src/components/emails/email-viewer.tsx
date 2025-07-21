"use client";

import { EmailWithCategory } from "@/app/actions/emails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Archive,
  Bot,
  Calendar,
  Clock,
  ExternalLink,
  Mail,
  Unlink,
  User,
} from "lucide-react";

interface EmailViewerProps {
  email: EmailWithCategory;
  onClose: () => void;
  open: boolean;
}

export function EmailViewer({ email, onClose, open }: EmailViewerProps) {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                Email Details
              </DialogTitle>
              <p className="text-sm text-gray-500">Viewing original email content</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email Header */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700">
                      {getSenderInitials(email.fromName, email.fromEmail)}
                    </span>
                  </div>

                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {email.fromName || email.fromEmail}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {email.fromEmail}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {email.isArchived && (
                    <Badge variant="secondary" className="text-xs">
                      <Archive className="h-3 w-3 mr-1" />
                      Archived
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {email.receivedAt.toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Subject */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {email.subject}
                </h3>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>From: {email.fromName || email.fromEmail}</span>
                </div>
                <div className="flex items-center justify-end space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>To: {email.toEmail}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Received: {formatRelativeTime(email.receivedAt)}</span>
                </div>
                {email.processedAt && (
                  <div className="flex items-center justify-end space-x-2">
                    <Bot className="h-4 w-4" />
                    <span>Processed: {formatRelativeTime(email.processedAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          {email.aiSummary && (
            <Card className="border border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg font-semibold text-blue-900">
                    AI Summary
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-blue-800 leading-relaxed">
                  {email.aiSummary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Email Body */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Email Content
              </CardTitle>
              <CardDescription>
                Original email content as received
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    This is a sample email content. In the actual implementation,
                    this would display the real email body content from the database.
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed mt-2">
                    The email body would be rendered here with proper formatting,
                    including any HTML content, images, and links that were in the original email.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Email ID: {email.id}</span>
              <span>•</span>
              <span>Gmail ID: {email.gmailId}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
              >
                <Unlink className="h-4 w-4 mr-2" />
                Unsubscribe
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Original
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 