import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAuthRedirectError } from "../hooks/useAuthRedirectError";

type Mode = "signin" | "signup";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: "14px",
  background: "#2a2a2a", color: "#fff", border: "1px solid #444", borderRadius: "6px",
};
const label: CSSProperties = { fontSize: "12px", color: "#aaa", marginBottom: "4px", display: "block" };

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

  const socialButton: CSSProperties = {
    padding: "10px", fontSize: "14px", background: "#2a2a2a", color: "#fff",
    border: "1px solid #444", borderRadius: "6px",
    cursor: isConfigured ? "pointer" : "not-allowed", opacity: isConfigured ? 1 : 0.5,
  };

  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#1e1e1e", color: "#fff", padding: "16px",
      }}
    >
      <div
        style={{
          width: "min(380px, 100%)", background: "#181818", border: "1px solid #333",
          borderRadius: "10px", padding: "28px", textAlign: "left",
          display: "flex", flexDirection: "column", gap: "16px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#888" }}>
            Accounts let you save and reopen your sessions.
          </p>
        </div>

        {!isConfigured && (
          <div style={{ fontSize: "12px", padding: "8px 10px", borderRadius: "6px", background: "#422006", color: "#fbbf24" }}>
            Login isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the dev server.
          </div>
        )}
        {notice && (
          <div style={{ fontSize: "13px", padding: "8px 10px", borderRadius: "6px", background: "#052e16", color: "#4ade80" }}>
            {notice}
          </div>
        )}
        {shownError && (
          <div role="alert" style={{ fontSize: "13px", padding: "8px 10px", borderRadius: "6px", background: "#450a0a", color: "#f87171" }}>
            {shownError}
          </div>
        )}

        <button
          type="button"
          onClick={() => social(signInWithGoogle)}
          disabled={!isConfigured}
          style={socialButton}
        >
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => social(signInWithGitHub)}
          disabled={!isConfigured}
          style={socialButton}
        >
          Continue with GitHub
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#666", fontSize: "12px" }}>
          <div style={{ flex: 1, height: "1px", background: "#333" }} />
          or
          <div style={{ flex: 1, height: "1px", background: "#333" }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {mode === "signup" && (
            <div>
              <label htmlFor="displayName" style={label}>Display name (optional)</label>
              <input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={24}
                autoComplete="nickname"
                style={input}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" style={label}>Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={input}
            />
          </div>
          <div>
            <label htmlFor="password" style={label}>Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              style={input}
            />
            {mode === "signup" && <span style={{ fontSize: "11px", color: "#666" }}>At least 8 characters.</span>}
          </div>

          <button
            type="submit"
            disabled={busy || !isConfigured}
            style={{
              padding: "10px", fontSize: "14px", fontWeight: 600, background: "#2563eb",
              color: "#fff", border: "none", borderRadius: "6px",
              cursor: busy || !isConfigured ? "not-allowed" : "pointer",
              opacity: busy || !isConfigured ? 0.6 : 1,
            }}
          >
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ fontSize: "13px", color: "#aaa", display: "flex", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={switchMode}
            style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", padding: 0, fontSize: "13px" }}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
          <Link to="/" style={{ color: "#888" }}>Continue as guest</Link>
        </div>
      </div>
    </div>
  );
}