"use client";

import { Category } from "@/app/actions/categories";
import { CreateCategoryInput } from "@/app/schemas/category";
import { CreateCategoryDialog } from "@/components/dashboard/create-category-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Clock, ExternalLink, Mail, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CategoriesCardProps {
  categories: Category[];
  isLoading: boolean;
  createCategory: (data: CreateCategoryInput) => Promise<{ success: boolean; error?: string }>;
  isCreating: boolean;
  onRefresh?: () => void;
}

export function CategoriesCard({ categories, isLoading, createCategory, isCreating, onRefresh }: CategoriesCardProps) {
  const hasCategories = categories.length > 0;
  const totalEmails = categories.reduce((sum, cat) => sum + (cat._count?.emails || 0), 0);
  const router = useRouter();

  // Add state for uncategorized email count
  const [uncategorizedCount, setUncategorizedCount] = useState<number>(0);

  useEffect(() => {
    async function fetchUncategorizedCount() {
      try {
        const { getUncategorizedEmailCountAction } = await import("@/app/actions/emails");
        const count = await getUncategorizedEmailCountAction();
        setUncategorizedCount(count);
      } catch {
        setUncategorizedCount(0);
      }
    }
    fetchUncategorizedCount();
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/category/${categoryId}`);
  };

  // AI Accuracy is the percentage of emails that have been categorized
  const aiAccuracy = categories.reduce((sum, cat) => sum + (cat._count?.emails || 0), 0) / totalEmails * 100;

  return (
    <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 shadow-lg h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">Email Categories</CardTitle>
              <CardDescription className="text-gray-600">
                Create custom categories for AI to sort your emails intelligently
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="shrink-0 hover:bg-blue-100"
                aria-label="Refresh categories"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <CreateCategoryDialog isCreating={isCreating} createCategory={createCategory}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CreateCategoryDialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        {hasCategories && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-blue-100">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Archive className="h-4 w-4 text-blue-600 mr-1" />
                <span className="text-lg font-bold text-blue-600">
                  {categories.length}
                </span>
              </div>
              <p className="text-xs text-gray-600">Categories</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Mail className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-lg font-bold text-green-600">
                  {totalEmails}
                </span>
              </div>
              <p className="text-xs text-gray-600">Emails Sorted</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Sparkles className="h-4 w-4 text-purple-600 mr-1" />
                <span className="text-lg font-bold text-purple-600">
                  {aiAccuracy ? aiAccuracy.toFixed(2) : 0}%
                </span>
              </div>
              <p className="text-xs text-gray-600">AI Accuracy</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading categories...</p>
          </div>
        ) : !hasCategories ? (
          /* Empty State - Enhanced */
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your First Category</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start organizing your emails with AI by creating categories.
              The AI will use these to automatically sort incoming emails.
            </p>
            <CreateCategoryDialog isCreating={isCreating} createCategory={createCategory}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Category
              </Button>
            </CreateCategoryDialog>
          </div>
        ) : (
          /* Categories List - Enhanced */
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 bg-white/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleCategoryClick(category.id)}>
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-semibold text-gray-900 truncate">{category.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {category._count?.emails || 0} emails
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {category.description}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Created {new Date(category.createdAt).toLocaleDateString()}</span>
                      </div>
                      {category._count?.emails > 0 && (
                        <div className="flex items-center space-x-1">
                          <Mail className="h-3 w-3" />
                          <span>Last email {new Date().toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCategoryClick(category.id)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            ))}
            {/* UNCATEGORIZED pseudo-category */}
            <div
              key="uncategorized"
              className="p-4 border border-yellow-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 bg-yellow-50/70"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleCategoryClick('uncategorized')}>
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold text-yellow-900 truncate">Uncategorized</h4>
                    <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-900">
                      {uncategorizedCount} emails
                    </Badge>
                  </div>
                  <p className="text-sm text-yellow-800 line-clamp-2 mb-2">
                    Emails that could not be categorized by AI
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-yellow-700">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Always visible</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCategoryClick('uncategorized')}
                  className="text-yellow-900 hover:text-yellow-800 hover:bg-yellow-100"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        {hasCategories && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Tip:</strong> Add detailed descriptions to your categories to help AI better understand
              and sort your emails. The more specific you are, the better the results!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 