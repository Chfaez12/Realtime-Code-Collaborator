import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { CodeIcon } from "../components/ui/Icons";
import { cardClass, inputClass, labelClass } from "../components/ui/styles";
import { useAuth } from "../hooks/useAuth";
import { useAuthRedirectError } from "../hooks/useAuthRedirectError";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { user, loading, isConfigured, signIn, signUp, signInWithGitHub, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  // Reason Supabase gives when a Google or GitHub login fails and sends the user back here
  const redirectError = useAuthRedirectError();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already logged in? Go back where you came from.
  if (!loading && user) return <Navigate to={from} replace />;

  const shownError = error ?? redirectError;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "signin") {
      const res = await signIn(email.trim(), password);
      if (res.error) setError(res.error);
      else navigate(from, { replace: true });
    } else {
      const res = await signUp(email.trim(), password, displayName.trim() || undefined);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) {
        setNotice("Account created. Check your email and click the confirmation link, then sign in.");
        setMode("signin");
        setPassword("");
      } else navigate(from, { replace: true });
    }
    setBusy(false);
  };

  const social = async (start: () => Promise<{ error: string | null }>) => {
    setError(null);
    const res = await start();
    if (res.error) setError(res.error); // on success the browser redirects to the provider
  };

  const switchMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setNotice(null);
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white">
          <CodeIcon size={20} />
        </span>

        <div className={`${cardClass} flex w-full flex-col gap-4 p-6`}>
          <div>
            <h1 className="text-xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-muted">Accounts let you save and reopen your sessions.</p>
          </div>

          {!isConfigured && (
            <p className="rounded-md bg-amber-950/60 px-3 py-2 text-xs text-amber-300">
              Login isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the
              dev server.
            </p>
          )}
          {notice && <p className="rounded-md bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{notice}</p>}
          {shownError && (
            <p role="alert" className="rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {shownError}
            </p>
          )}

          <div className="grid gap-2">
            <Button size="md" disabled={!isConfigured} onClick={() => social(signInWithGoogle)}>
              Continue with Google
            </Button>
            <Button size="md" disabled={!isConfigured} onClick={() => social(signInWithGitHub)}>
              Continue with GitHub
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <div>
                <label htmlFor="displayName" className={labelClass}>
                  Display name (optional)
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className={inputClass}
              />
              {mode === "signup" && <p className="mt-1 text-xs text-subtle">At least 8 characters.</p>}
            </div>

            <Button type="submit" variant="primary" size="md" disabled={busy || !isConfigured}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={switchMode} className="text-blue-400 hover:underline">
              {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>
            <Link to="/" className="text-muted hover:text-neutral-200">
              Continue as guest
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}