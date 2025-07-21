"use client";

import { Category } from "@/app/actions/categories";
import { EmailWithCategory } from "@/app/actions/emails";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CategoryHeader } from "@/components/emails/category-header";
import { EmailList } from "@/components/emails/email-list";
import { EmailViewer } from "@/components/emails/email-viewer";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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

// Main category detail content
function CategoryDetailContent({ categoryId, session }: { categoryId: string; session: Session }) {
  const [emails, setEmails] = useState<EmailWithCategory[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<EmailWithCategory | null>(null);
  const [isViewingEmail, setIsViewingEmail] = useState(false);

  // Mock data for now - will be replaced with actual API calls
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setCategory({
        id: categoryId,
        name: "Sample Category",
        description: "This is a sample category for demonstration",
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { emails: 5 }
      });

      setEmails([
        {
          id: "1",
          gmailId: "gmail1",
          subject: "Welcome to our newsletter",
          fromEmail: "newsletter@example.com",
          fromName: "Newsletter Team",
          toEmail: "user@example.com",
          aiSummary: "This is a welcome email for new subscribers with information about upcoming content.",
          isArchived: false,
          receivedAt: new Date(),
          processedAt: new Date(),
          createdAt: new Date(),
          category: {
            id: categoryId,
            name: "Sample Category",
            description: "This is a sample category"
          }
        },
        {
          id: "2",
          gmailId: "gmail2",
          subject: "Weekly digest - Top stories",
          fromEmail: "digest@example.com",
          fromName: "Digest Service",
          toEmail: "user@example.com",
          aiSummary: "Weekly summary of the most important stories and updates from the past week.",
          isArchived: false,
          receivedAt: new Date(Date.now() - 86400000),
          processedAt: new Date(Date.now() - 86400000),
          createdAt: new Date(Date.now() - 86400000),
          category: {
            id: categoryId,
            name: "Sample Category",
            description: "This is a sample category"
          }
        }
      ]);
      setIsLoading(false);
    }, 1000);
  }, [categoryId]);

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
    setSelectedEmails(new Set());
  };

  const handleUnsubscribeSelected = () => {
    // TODO: Implement unsubscribe functionality
    console.log("Unsubscribe from selected emails:", Array.from(selectedEmails));
    setSelectedEmails(new Set());
  };

  const handleEmailClick = (email: EmailWithCategory) => {
    setSelectedEmail(email);
    setIsViewingEmail(true);
  };

  const handleCloseEmailViewer = () => {
    setIsViewingEmail(false);
    setSelectedEmail(null);
  };

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
              onClose={handleCloseEmailViewer}
              open={isViewingEmail}
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