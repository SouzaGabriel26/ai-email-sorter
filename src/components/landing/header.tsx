import { Mail } from "lucide-react"

export function LandingHeader() {
  return (
    <header className="container mx-auto px-4 py-6">
      <nav className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">AI Email Sorter</span>
        </div>
      </nav>
    </header>
  )
} 