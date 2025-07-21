import { useEffect, useState } from "react";
import { EmailDetails, getEmailDetailsAction } from "../actions/emails";

export function useEmailDetails(emailId: string | null) {
  const [emailDetails, setEmailDetails] = useState<EmailDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchEmailDetails() {
    if (!emailId) return;

    try {
      setIsLoading(true);
      setError(null);

      const details = await getEmailDetailsAction(emailId);
      setEmailDetails(details);
    } catch (err) {
      console.error("Error fetching email details:", err);
      setError("Failed to load email details");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (emailId) {
      fetchEmailDetails();
    } else {
      setEmailDetails(null);
    }
  }, [emailId]);

  return {
    emailDetails,
    isLoading,
    error,
  };
}
