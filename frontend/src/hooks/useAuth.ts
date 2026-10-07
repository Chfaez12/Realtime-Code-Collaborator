import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// The name to show in the UI and on cursors. Falls back to the part of the email before the @.
export function getDisplayName(
  user: { email?: string; user_metadata?: Record<string, unknown> } | null
): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata ?? {};
  const name = (meta.display_name ?? meta.user_name ?? meta.full_name) as string | undefined;
  return name || user.email?.split("@")[0];
}