import { useEffect, useState } from "react";

// Supabase reports a failed social login in the URL, in the query string or the hash
export function useAuthRedirectError(): string | null {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description = query.get("error_description") ?? hash.get("error_description");
    const code = query.get("error_code") ?? hash.get("error_code");
    if (!description && !code) return;

    setMessage(description ?? code);
    // Clear it from the address bar so a refresh doesn't show it again
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return message;
}