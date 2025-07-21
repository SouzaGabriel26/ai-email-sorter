"use client";

import { EmailWithCategory } from "@/app/actions/emails";
import { useCategory } from "@/app/hooks/useCategory";
import { useEmailDetails } from "@/app/hooks/useEmailDetails";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CategoryHeader } from "@/components/emails/category-header";
import { EmailList } from "@/components/emails/email-list";
import { EmailViewer } from "@/components/emails/email-viewer";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

interface CategoryDetailPageProps {
  params: {
    id: string;
  };
}

// Loading component for better UX
function CategoryDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading category...</p>
      </div>
    </div>
  );
}

// Error component
function CategoryDetailError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Category</h3>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Main category detail content
function CategoryDetailContent({ categoryId, session }: { categoryId: string; session: Session }) {
  const { category, emails, isLoading, error, refetch } = useCategory(categoryId);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<EmailWithCategory | null>(null);
  const [isViewingEmail, setIsViewingEmail] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const { emailDetails, isLoading: emailDetailsLoading } = useEmailDetails(selectedEmailId);

  const handleEmailSelect = (emailId: string, selected: boolean) => {
    const newSelected = new Set(selectedEmails);
    if (selected) {
      newSelected.add(emailId);
    } else {
      newSelected.delete(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(email => email.id)));
    }
  };

  const handleDeleteSelected = () => {
    // TODO: Implement delete functionality
    console.log("Delete selected emails:", Array.from(selectedEmails));
    toast.success("Delete functionality coming soon", {
      description: "This will be implemented in the next phase",
    });
    setSelectedEmails(new Set());
  };

  const handleUnsubscribeSelected = () => {
    // TODO: Implement unsubscribe functionality
    console.log("Unsubscribe from selected emails:", Array.from(selectedEmails));
    toast.success("Unsubscribe functionality coming soon", {
      description: "This will be implemented in the next phase",
    });
    setSelectedEmails(new Set());
  };

  const handleEmailClick = (email: EmailWithCategory) => {
    setSelectedEmail(email);
    setSelectedEmailId(email.id);
    setIsViewingEmail(true);
  };

  const handleCloseEmailViewer = () => {
    setIsViewingEmail(false);
    setSelectedEmail(null);
    setSelectedEmailId(null);
  };

  if (error) {
    return <CategoryDetailError error={error} onRetry={refetch} />;
  }

  if (isLoading) {
    return <CategoryDetailLoading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <DashboardHeader session={session} />

      <main className="container mx-auto px-4 py-6 sm:py-8" role="main">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Category Header */}
          <CategoryHeader
            category={category}
            totalEmails={emails.length}
            selectedCount={selectedEmails.size}
            onSelectAll={handleSelectAll}
            onDeleteSelected={handleDeleteSelected}
            onUnsubscribeSelected={handleUnsubscribeSelected}
            isAllSelected={selectedEmails.size === emails.length}
          />

          {/* Email List */}
          <EmailList
            emails={emails}
            selectedEmails={selectedEmails}
            onEmailSelect={handleEmailSelect}
            onEmailClick={handleEmailClick}
            isLoading={isLoading}
          />

          {/* Email Viewer Modal */}
          {isViewingEmail && selectedEmail && (
            <EmailViewer
              email={selectedEmail}
              emailDetails={emailDetails}
              onClose={handleCloseEmailViewer}
              open={isViewingEmail}
              isLoading={emailDetailsLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Main category detail page component
export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return <CategoryDetailLoading />;
  }

  if (!session) {
    return null;
  }

  return (
    <Suspense fallback={<CategoryDetailLoading />}>
      <CategoryDetailContent categoryId={id} session={session} />
    </Suspense>
  );
} 