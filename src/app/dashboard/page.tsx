"use client"

import { CategoriesCard } from "@/components/dashboard/categories-card"
import { ConnectedAccountsCard } from "@/components/dashboard/connected-accounts-card"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { GettingStartedCard } from "@/components/dashboard/getting-started-card"
import { GmailWatchCard } from "@/components/dashboard/gmail-watch-card"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { WelcomeSection } from "@/components/dashboard/welcome-section"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { toast } from "sonner"
import { useCategories } from "../hooks/useCategories"
import { useStats } from "../hooks/useStats"

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { totalEmailsProcessed, connectedAccounts, isLoading: isStatsLoading } = useStats()
  const { categories, isLoading: isCategoriesLoading, createCategory, isCreating } = useCategories()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Handle connection results
  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")

    if (success === "account-connected") {
      toast.success("Account connected!", {
        description: "Your additional Gmail account has been connected successfully.",
      })
      // Clear the URL parameters
      router.replace("/dashboard", { scroll: false })
    } else if (error) {
      toast.error("Connection failed", {
        description: "Failed to connect additional account. Please try again.",
      })
      // Clear the URL parameters
      router.replace("/dashboard", { scroll: false })
    }
  }, [searchParams, router])

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
            <ConnectedAccountsCard session={session} connectedAccounts={connectedAccounts} isLoading={isStatsLoading} />
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
            isLoading={isStatsLoading}
          />
          <GettingStartedCard />
        </div>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
} 