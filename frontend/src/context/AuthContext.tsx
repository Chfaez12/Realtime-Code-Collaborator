import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

export interface AuthResult {
  error: string | null;
  needsConfirmation?: boolean; // sign-up worked, but the email must be confirmed first
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  signInWithGitHub: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const NOT_CONFIGURED: AuthResult = {
  error: "Login isn't configured. Add your Supabase keys to .env and restart the dev server.",
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string): Promise<AuthResult> => {
      if (!supabase) return NOT_CONFIGURED;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: displayName ? { display_name: displayName } : undefined },
      });
      if (error) return { error: error.message };
      // No session yet means Supabase is waiting for the user to confirm their email
      return { error: null, needsConfirmation: !data.session };
    },
    []
  );

  const signInWithProvider = useCallback(async (provider: "github" | "google"): Promise<AuthResult> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Failed logins come back to /login, where the error message is shown
      options: { redirectTo: `${window.location.origin}/login` },
    });
    return { error: error?.message ?? null }; // on success the browser leaves for the provider
  }, []);

  const signInWithGitHub = useCallback(() => signInWithProvider("github"), [signInWithProvider]);
  const signInWithGoogle = useCallback(() => signInWithProvider("google"), [signInWithProvider]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      loading,
      isConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signInWithGitHub,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, signIn, signUp, signInWithGitHub, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}