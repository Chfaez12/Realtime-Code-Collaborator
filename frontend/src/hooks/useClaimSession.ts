import { useEffect } from "react";
import { claimSession } from "../lib/sessionsApi";
import { getActiveOwnerToken } from "./useSession";
import { useAuth } from "./useAuth";

export function useClaimSession(slug: string | undefined, enabled: boolean) {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!slug || !enabled || !userId) return;
    const ownerToken = getActiveOwnerToken(slug);
    if (!ownerToken) return; // only the owner can claim a session

    // Not critical: if it fails (offline, owned by someone else), it simply retries next visit
    claimSession(slug, ownerToken).catch(() => {});
  }, [slug, enabled, userId]);
}