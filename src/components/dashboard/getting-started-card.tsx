import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function GettingStartedCard() {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Getting Started</CardTitle>
        <CardDescription>
          Follow these steps to set up your AI email sorting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
            </div>
            <div>
              <p className="font-medium text-gray-900">Gmail Account Connected</p>
              <p className="text-sm text-gray-500">Your Gmail account is connected and ready to use</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
            <div>
              <p className="font-medium text-gray-900">Create Email Categories</p>
              <p className="text-sm text-gray-500">Define categories with descriptions for AI to use when sorting emails</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
            <div>
              <p className="font-medium text-gray-900">Watch AI in Action</p>
              <p className="text-sm text-gray-500">New emails will be automatically sorted and summarized</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 