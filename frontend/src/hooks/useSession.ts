import { useMemo } from "react";

const key = (slug: string) => `collab-owner:${slug}`;

export function saveOwnerToken(slug: string, token: string) {
  try {
    localStorage.setItem(key(slug), token);
  } catch {
    /* storage unavailable: the creator just won't get owner controls */
  }
}

function readOwnerToken(slug: string): string | null {
  try {
    return localStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function getActiveOwnerToken(slug: string): string | null {
  if (new URLSearchParams(window.location.search).get("as") === "guest") return null;
  return readOwnerToken(slug);
}

export function isSessionOwner(slug: string): boolean {
  return getActiveOwnerToken(slug) !== null;
}

export function useSession(slug: string) {
  const isOwner = useMemo(() => isSessionOwner(slug), [slug]);
  return { isOwner };
}