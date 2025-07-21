"use client";

import { CategoriesCard } from "@/components/dashboard/categories-card";
import { ConnectedAccountsCard } from "@/components/dashboard/connected-accounts-card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { GettingStartedCard } from "@/components/dashboard/getting-started-card";
import { GmailWatchCard } from "@/components/dashboard/gmail-watch-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { WelcomeSection } from "@/components/dashboard/welcome-section";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useCategories } from "../hooks/useCategories";
import { useEmailStats } from "../hooks/useEmails";

// Loading component for better UX
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your dashboard...</p>
      </div>
    </div>
  );
}

// Main dashboard content with proper error boundaries
function DashboardContent({ session }: { session: Session }) {
  // Data hooks with error handling
  const { categories, isLoading: categoriesLoading, createCategory, isCreating, refetch: refetchCategories } = useCategories();
  const { stats: emailStats, isLoading: emailStatsLoading, refetch: refetchStats } = useEmailStats();

  const hasEmails = emailStats.totalEmails > 0;
  const hasCategories = categories.length > 0;

  // Refresh functions
  const handleRefreshCategories = () => {
    refetchCategories();
  };

  const handleRefreshStats = () => {
    refetchStats();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <DashboardHeader session={session} />

      <main className="container mx-auto px-4 py-6 sm:py-8" role="main">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

          {/* Welcome Section - Compact for mobile */}
          <div className="hidden sm:block">
            <WelcomeSection userName={session.user.name} />
          </div>

          {/* Priority Section 1: Email Categories - Most Important */}
          <section aria-labelledby="categories-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="categories-heading" className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="mr-2">📧</span>
                Email Categories
              </h2>
              <div className="text-sm text-gray-500">
                {hasCategories ? `${categories.length} categories` : 'No categories yet'}
              </div>
            </div>

            <CategoriesCard
              categories={categories}
              isLoading={categoriesLoading}
              createCategory={createCategory}
              isCreating={isCreating}
              onRefresh={handleRefreshCategories}
            />
          </section>

          {/* Priority Section 2: Connected Accounts - Second Most Important */}
          <section aria-labelledby="accounts-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="accounts-heading" className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="mr-2">🔗</span>
                Connected Accounts
              </h2>
            </div>

            <ConnectedAccountsCard session={session} />
          </section>

          {/* Secondary Information: Stats and Monitoring */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

            {/* Stats Card - Compact */}
            <div className="lg:col-span-2">
              <StatsCard
                stats={emailStats}
                isLoading={emailStatsLoading}
                onRefresh={handleRefreshStats}
              />
            </div>

            {/* Gmail Watch Status - Compact */}
            <div className="lg:col-span-1">
              <GmailWatchCard />
            </div>
          </div>

          {/* Getting Started - Only show if no categories or accounts */}
          {(!hasCategories || emailStats.totalEmails === 0) && (
            <section aria-labelledby="getting-started-heading">
              <GettingStartedCard />
            </section>
          )}

          {/* AI Processing Insights - Only show when there's activity */}
          {hasEmails && (
            <section aria-labelledby="insights-heading" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 id="insights-heading" className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <span role="img" aria-label="robot">🤖</span>
                <span>AI Processing Insights</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">
                    {emailStats.totalEmails > 0
                      ? Math.round((emailStats.categorizedEmails / emailStats.totalEmails) * 100)
                      : 0}%
                  </div>
                  <div className="text-blue-800 font-medium">Success Rate</div>
                  <div className="text-xs text-blue-600 mt-1">
                    AI correctly categorized emails
                  </div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-2xl font-bold text-green-600">
                    {emailStats.categorizedEmails}
                  </div>
                  <div className="text-green-800 font-medium">Auto-Sorted</div>
                  <div className="text-xs text-green-600 mt-1">
                    Emails automatically organized
                  </div>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="text-2xl font-bold text-purple-600">
                    {categories.length}
                  </div>
                  <div className="text-purple-800 font-medium">Categories</div>
                  <div className="text-xs text-purple-600 mt-1">
                    Available for AI sorting
                  </div>
                </div>
              </div>

              {emailStats.categorizedEmails > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2">
                    <span role="img" aria-label="sparkles">✨</span>
                    <span className="text-sm font-medium text-green-800">
                      Your AI email assistant is working!
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    {emailStats.categorizedEmails} emails have been automatically categorized and summarized.
                    Check your categories to see the AI-generated summaries.
                  </p>
                </div>
              )}

              {emailStats.uncategorizedEmails > 5 && categories.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-2">
                    <span role="img" aria-label="lightbulb">💡</span>
                    <span className="text-sm font-medium text-yellow-800">
                      Improve AI accuracy
                    </span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    {emailStats.uncategorizedEmails} emails couldn&apos;t be categorized.
                    Consider adding more specific category descriptions or creating new categories.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

// Main dashboard component with proper error handling and loading states
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
      return;
    }
  }, [session, status, router]);

  // Loading state
  if (status === "loading") {
    return <DashboardLoading />;
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent session={session} />
    </Suspense>
  );
} 