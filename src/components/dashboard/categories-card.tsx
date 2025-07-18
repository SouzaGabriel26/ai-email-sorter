import { Category } from "@/app/actions/categories"
import { CreateCategoryInput } from "@/app/schemas/category"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Plus } from "lucide-react"
import { CreateCategoryDialog } from "./create-category-dialog"

interface CategoriesCardProps {
  categories: Category[];
  isLoading: boolean;
  createCategory: (data: CreateCategoryInput) => Promise<{ success: boolean; error?: string }>;
  isCreating: boolean;
}

export function CategoriesCard({ categories, isLoading, createCategory, isCreating }: CategoriesCardProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email Categories</CardTitle>
            <CardDescription>
              Create custom categories for AI to sort your emails
            </CardDescription>
          </div>
          <CreateCategoryDialog isCreating={isCreating} createCategory={createCategory}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </CreateCategoryDialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first category to start organizing emails with AI
            </p>
            <CreateCategoryDialog isCreating={isCreating} createCategory={createCategory}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Category
              </Button>
            </CreateCategoryDialog>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {category.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Created {new Date(category.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {category._count.emails} emails
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 