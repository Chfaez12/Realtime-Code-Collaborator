import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getActiveOwnerToken, saveOwnerToken } from "../hooks/useSession";
import { getDisplayName, useAuth } from "../hooks/useAuth";
import { createSession, listMySessions, recoverOwnerToken, type MySession } from "../lib/sessionsApi";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function expiryLabel(s: MySession): string {
  if (s.expires_at) return `Expires ${formatDate(s.expires_at)}`;
  if (s.is_persistent) return "Never expires";
  return "No expiry set";
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<MySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await listMySessions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your sessions");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: "/dashboard" }} />;

  const open = async (slug: string) => {
    setOpening(slug);
    setError(null);
    try {
      // On a new device there is no owner token yet: ask the server for a fresh one
      if (!getActiveOwnerToken(slug)) {
        const { owner_token } = await recoverOwnerToken(slug);
        saveOwnerToken(slug, owner_token);
      }
      navigate(`/s/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the session");
      setOpening(null);
    }
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createSession();
      saveOwnerToken(created.slug, created.owner_token);
      navigate(`/s/${created.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the session");
      setCreating(false);
    }
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 2000);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  const button = {
    padding: "5px 12px", fontSize: "12px", borderRadius: "4px", cursor: "pointer",
    background: "transparent", color: "#fff", border: "1px solid #555",
  } as const;

  return (
    <div style={{ minHeight: "100vh", background: "#1e1e1e", color: "#fff", padding: "24px 16px" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>Your sessions</h1>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}>
              Signed in as {getDisplayName(user)}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Link to="/" style={{ color: "#888", fontSize: "13px" }}>Home</Link>
            <button onClick={signOut} style={button}>Sign out</button>
            <button
              onClick={create}
              disabled={creating}
              style={{
                ...button, background: "#2563eb", border: "none", fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? "Creating..." : "New session"}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" style={{ fontSize: "13px", padding: "8px 10px", borderRadius: "6px", background: "#450a0a", color: "#f87171", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        {sessions === null && !error && <div style={{ color: "#888", fontSize: "14px" }}>Loading...</div>}

        {sessions?.length === 0 && (
          <div style={{ color: "#888", fontSize: "14px" }}>
            Nothing here yet. Sessions you create while signed in will appear here. Ones you made as a guest
            join your account the next time you open them while signed in.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sessions?.map((s) => (
            <div
              key={s.slug}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                background: "#181818", border: "1px solid #333", borderRadius: "8px", padding: "12px 14px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.has_password && <span title="Password protected">🔒 </span>}
                  {s.title}
                </div>
                <div style={{ fontSize: "12px", color: "#888", marginTop: "3px" }}>
                  <code style={{ color: "#aaa" }}>{s.slug}</code> · {s.language} · edited{" "}
                  {formatDate(s.updated_at ?? s.created_at)} · {expiryLabel(s)}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button onClick={() => copyLink(s.slug)} style={button}>
                  {copied === s.slug ? "Copied!" : "Copy link"}
                </button>
                <button
                  onClick={() => open(s.slug)}
                  disabled={opening === s.slug}
                  style={{ ...button, background: "#2563eb", border: "none", opacity: opening === s.slug ? 0.6 : 1 }}
                >
                  {opening === s.slug ? "Opening..." : "Open"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}