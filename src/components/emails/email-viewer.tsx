"use client";

import { EmailDetails, EmailWithCategory } from "@/app/actions/emails";
import { unsubscribeFromEmailsAction } from "@/app/actions/unsubscribe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Archive,
  Bot,
  Calendar,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Trash2,
  Unlink,
  User
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EmailViewerProps {
  email: EmailWithCategory;
  emailDetails: EmailDetails | null;
  onClose: () => void;
  onDelete: (emailId: string) => void;
  open: boolean;
  isLoading?: boolean;
}

export function EmailViewer({ email, emailDetails, onClose, onDelete, open, isLoading = false }: EmailViewerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

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

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true);
    try {
      const results = await unsubscribeFromEmailsAction([email.id]);
      const result = results[0];
      if (result.status === "completed") {
        toast.success("Successfully unsubscribed from this email");
      } else if (result.status === "no_links_found") {
        toast("No unsubscribe link found for this email");
      } else {
        toast.error("Failed to unsubscribe", { description: result.error });
      }
    } catch (error) {
      toast.error("Unsubscribe failed");
    } finally {
      setIsUnsubscribing(false);
    }
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
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-gray-600">Loading email content...</span>
                </div>
              ) : emailDetails ? (
                <div className="prose max-w-none">
                  {emailDetails.bodyHtml ? (
                    <div
                      className="bg-gray-50 p-4 rounded-lg border"
                      dangerouslySetInnerHTML={{ __html: emailDetails.bodyHtml }}
                    />
                  ) : emailDetails.bodyText ? (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {emailDetails.bodyText}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <p className="text-gray-500 text-sm">
                        No email content available. The email body was not stored or is empty.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-500 text-sm">
                    Email content not available. This might be a notification or system email.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Email ID: {email.id}</span>
              <span>•</span>
              <span>Gmail ID: {email.gmailId}</span>
              <span>•</span>
              <span>Account: {email.toEmail}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                onClick={handleUnsubscribe}
                disabled={isUnsubscribing}
              >
                <Unlink className="h-4 w-4 mr-2" />
                {isUnsubscribing ? "Unsubscribing..." : "Unsubscribe"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View in Gmail
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    onClick={() => {
                      // Use only Subject + sender search format
                      const searchQuery = `subject:"${email.subject}" from:${email.fromEmail}`;
                      const url = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Gmail
                    <span className="ml-auto text-xs text-gray-500">Direct search</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      // Copy only the Subject + sender search query
                      const searchQuery = `subject:"${email.subject}" from:${email.fromEmail}`;

                      navigator.clipboard.writeText(searchQuery).then(() => {
                        toast.success("Search query copied to clipboard", {
                          description: "Subject + sender search format",
                        });
                      }).catch(() => {
                        toast.error("Failed to copy search query", {
                          description: "Please try again",
                        });
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy search query
                    <span className="ml-auto text-xs text-gray-500">Subject + sender</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Email"
        description={`Are you sure you want to delete the email "${email.subject}"? This will delete it from both the app and Gmail. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => {
          onDelete(email.id);
          setShowDeleteConfirm(false);
          onClose();
        }}
      />
    </Dialog>
  );
} 