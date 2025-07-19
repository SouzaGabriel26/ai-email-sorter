"use client"

import { CategoriesCard } from "@/components/dashboard/categories-card"
import { ConnectedAccountsCard } from "@/components/dashboard/connected-accounts-card"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { GettingStartedCard } from "@/components/dashboard/getting-started-card"
import { GmailWatchCard } from "@/components/dashboard/gmail-watch-card"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { WelcomeSection } from "@/components/dashboard/welcome-section"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useCategories } from "../hooks/useCategories"
import { useStats } from "../hooks/useStats"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { totalEmailsProcessed, connectedAccounts, isLoading } = useStats()
  const { categories, isLoading: isCategoriesLoading, createCategory, isCreating } = useCategories()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Redirecting to home...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader session={session} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <WelcomeSection userName={session.user.name} />

          {/* Main Dashboard Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            <ConnectedAccountsCard session={session} />
            <CategoriesCard
              categories={categories}
              isLoading={isCategoriesLoading}
              createCategory={createCategory}
              isCreating={isCreating}
            />
          </div>

          {/* Gmail Watch Card */}
          <div className="mt-8">
            <GmailWatchCard />
          </div>

          <StatsCards
            totalEmailsProcessed={totalEmailsProcessed}
            activeCategories={categories.length}
            connectedAccounts={connectedAccounts}
            isLoading={isLoading}
          />
          <GettingStartedCard />
        </div>
      </main>
    </div>
  )
} 