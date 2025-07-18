import { Card, CardContent } from "@/components/ui/card";
import { Mail, Settings, Users } from "lucide-react";

interface StatsCardsProps {
  totalEmailsProcessed: number;
  activeCategories: number;
  connectedAccounts: number;
  isLoading: boolean;
}

export function StatsCards({ totalEmailsProcessed, activeCategories, connectedAccounts, isLoading }: StatsCardsProps) {
  return (
    <div className="grid md:grid-cols-3 gap-6 mt-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Emails Processed</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? 0 : totalEmailsProcessed}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <Settings className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Categories</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? 0 : activeCategories}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Connected Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? 0 : connectedAccounts}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 