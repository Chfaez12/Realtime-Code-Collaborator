import { useMemo } from "react";
import { useAuth } from "./useAuth";

const GUEST_KEY = "collab-guest-id";

function guestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage unavailable: stable for this page load only
  }
}

// Logged-in users are identified by their account, everyone else by a random id kept in the browser
export function useAuthorKey(): string {
  const { user } = useAuth();
  const userId = user?.id;
  return useMemo(() => userId ?? guestId(), [userId]);
}