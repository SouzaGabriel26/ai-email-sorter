"use client";

import { CategoriesCard } from "@/components/dashboard/categories-card";
import { ConnectedAccountsCard } from "@/components/dashboard/connected-accounts-card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { GettingStartedCard } from "@/components/dashboard/getting-started-card";
import { GmailWatchCard } from "@/components/dashboard/gmail-watch-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { WelcomeSection } from "@/components/dashboard/welcome-section";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCategories } from "../hooks/useCategories";
import { useEmailStats } from "../hooks/useEmails";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data hooks
  const { categories, isLoading: categoriesLoading, createCategory, isCreating } = useCategories();
  const { stats: emailStats, isLoading: emailStatsLoading } = useEmailStats();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const hasEmails = emailStats.totalEmails > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader session={session} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Welcome Section */}
          <WelcomeSection userName={session.user.name} />

          {/* AI Email Processing Stats */}
          <StatsCard stats={emailStats} isLoading={emailStatsLoading} />

          {/* Main Dashboard Grid */}
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Left Column */}
            <div className="space-y-8">

              {/* Categories Management */}
              <CategoriesCard
                categories={categories}
                isLoading={categoriesLoading}
                createCategory={createCategory}
                isCreating={isCreating}
              />

              {/* Connection Stats */}
              <ConnectedAccountsCard session={session} />

            </div>

            {/* Right Column */}
            <div className="space-y-8">

              {/* Gmail Watch Management */}
              <GmailWatchCard />

              {/* Getting Started Guide */}
              <GettingStartedCard />

            </div>

          </div>

          {/* AI Processing Insights */}
          {hasEmails && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <span>🤖</span>
                <span>AI Processing Insights</span>
              </h3>

              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {emailStats.totalEmails > 0
                      ? Math.round((emailStats.categorizedEmails / emailStats.totalEmails) * 100)
                      : 0}%
                  </div>
                  <div className="text-blue-800">Success Rate</div>
                  <div className="text-xs text-blue-600 mt-1">
                    AI correctly categorized emails
                  </div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {emailStats.categorizedEmails}
                  </div>
                  <div className="text-green-800">Auto-Sorted</div>
                  <div className="text-xs text-green-600 mt-1">
                    Emails automatically organized
                  </div>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {categories.length}
                  </div>
                  <div className="text-purple-800">Categories</div>
                  <div className="text-xs text-purple-600 mt-1">
                    Available for AI sorting
                  </div>
                </div>
              </div>

              {emailStats.categorizedEmails > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✨</span>
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
                    <span className="text-yellow-600">💡</span>
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
            </div>
          )}

        </div>
      </main>
    </div>
  );
} 