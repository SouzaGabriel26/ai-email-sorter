import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users } from "lucide-react"
import { Session } from "next-auth"

interface ConnectedAccountsCardProps {
  session: Session
}

export function ConnectedAccountsCard({ session }: ConnectedAccountsCardProps) {
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
        {/* Current Account */}
        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
          <Avatar className="h-10 w-10">
            <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
            <AvatarFallback>
              {session.user.name?.split(" ").map(n => n[0]).join("") || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session.user.email}
            </p>
            <p className="text-xs text-blue-600">Primary Account</p>
          </div>
        </div>

        {/* Add Account Button */}
        <Button variant="outline" className="w-full cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Connect Another Gmail Account
        </Button>
      </CardContent>
    </Card>
  )
} 