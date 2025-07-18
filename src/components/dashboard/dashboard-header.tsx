import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, Mail } from "lucide-react"
import { Session } from "next-auth"
import { signOut } from "next-auth/react"

interface DashboardHeaderProps {
  session: Session
}

export function DashboardHeader({ session }: DashboardHeaderProps) {
  return (
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">AI Email Sorter</span>
          </div>

          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
              <AvatarFallback>
                {session.user.name?.split(" ").map(n => n[0]).join("") || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
              <p className="text-xs text-gray-500">{session.user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
} 