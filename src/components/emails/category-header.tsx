"use client";

import { Category } from "@/app/actions/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Mail,
  Square,
  Trash2,
  Unlink,
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";

interface CategoryHeaderProps {
  category: Category | null;
  totalEmails: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onUnsubscribeSelected: () => void;
  isAllSelected: boolean;
  isUnsubscribing?: boolean;
}

export function CategoryHeader({
  category,
  totalEmails,
  selectedCount,
  onSelectAll,
  onDeleteSelected,
  onUnsubscribeSelected,
  isAllSelected,
  isUnsubscribing = false,
}: CategoryHeaderProps) {
  const router = useRouter();

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  if (!category) {
    return (
      <Card className="border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  {category.name}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {category.description}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-sm">
              <Mail className="h-3 w-3 mr-1" />
              {totalEmails} emails
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-blue-100">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Mail className="h-4 w-4 text-blue-600 mr-1" />
              <span className="text-lg font-bold text-blue-600">
                {totalEmails}
              </span>
            </div>
            <p className="text-xs text-gray-600">Total Emails</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Calendar className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-lg font-bold text-green-600">
                {category._count.emails}
              </span>
            </div>
            <p className="text-xs text-gray-600">Processed</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-purple-600 mr-1" />
              <span className="text-lg font-bold text-purple-600">
                {Math.round((category._count.emails / Math.max(totalEmails, 1)) * 100)}%
              </span>
            </div>
            <p className="text-xs text-gray-600">Success Rate</p>
          </div>
        </div>

        {/* Bulk Actions */}
        {totalEmails > 0 && (
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="flex items-center space-x-2"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>
                  {isAllSelected ? "Deselect All" : "Select All"}
                </span>
              </Button>

              {selectedCount > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {selectedCount} selected
                </Badge>
              )}
            </div>

            {selectedCount > 0 && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnsubscribeSelected}
                  className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                  disabled={isUnsubscribing}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  {isUnsubscribing ? (
                    <span className="flex items-center"><span className="animate-spin mr-2 w-4 h-4 border-b-2 border-yellow-600 rounded-full"></span>Unsubscribing...</span>
                  ) : (
                    <>Unsubscribe ({selectedCount})</>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeleteSelected}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedCount})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 