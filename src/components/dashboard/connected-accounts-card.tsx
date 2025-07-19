import { useStats } from "@/app/hooks/useStats"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users } from "lucide-react"
import { Session } from "next-auth"

interface ConnectedAccountsCardProps {
  session: Session
}

export function ConnectedAccountsCard({ session }: ConnectedAccountsCardProps) {
  const { connectedAccounts, isLoading } = useStats()

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Connected Accounts
        </CardTitle>
        <CardDescription>
          Gmail accounts connected to your AI Email Sorter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Summary */}
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
              <AvatarFallback>
                {session.user.name?.split(" ").map(n => n[0]).join("") || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
              <p className="text-xs text-blue-600">Primary Account</p>
            </div>
          </div>
          <p className="text-lg font-bold text-blue-600">
            {isLoading ? "..." : connectedAccounts} Gmail Account{connectedAccounts !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-500">Connected to your account</p>
        </div>

        {/* Add Account Button */}
        <Button variant="outline" className="w-full cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Connect Another Gmail Account
        </Button>

        {/* Help Text */}
        <p className="text-xs text-gray-500 text-center">
          Connect multiple Gmail accounts to process emails from all your inboxes
        </p>
      </CardContent>
    </Card>
  )
} 