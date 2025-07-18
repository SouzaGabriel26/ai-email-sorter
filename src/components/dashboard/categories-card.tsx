import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Plus } from "lucide-react"

export function CategoriesCard() {
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
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Placeholder for categories */}
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first category to start organizing emails with AI
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Category
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 