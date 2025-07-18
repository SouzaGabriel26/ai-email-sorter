interface WelcomeSectionProps {
  userName?: string | null
}

export function WelcomeSection({ userName }: WelcomeSectionProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Welcome back, {userName?.split(" ")[0] || "User"}!
      </h1>
      <p className="text-gray-600">
        Manage your Gmail accounts, create categories, and let AI organize your emails.
      </p>
    </div>
  )
} 