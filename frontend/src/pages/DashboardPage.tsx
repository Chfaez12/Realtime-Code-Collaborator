import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { LockIcon } from "../components/ui/Icons";
import { cardClass } from "../components/ui/styles";
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

  return (
    <div className="min-h-dvh bg-canvas px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your sessions</h1>
            <p className="mt-0.5 text-sm text-muted">Signed in as {getDisplayName(user)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="mr-1 text-sm text-muted hover:text-neutral-200">
              Home
            </Link>
            <Button onClick={signOut}>Sign out</Button>
            <Button variant="primary" onClick={create} disabled={creating}>
              {creating ? "Creating..." : "New session"}
            </Button>
          </div>
        </header>

        {error && (
          <p role="alert" className="mb-4 rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {sessions === null && !error && <p className="text-sm text-muted">Loading...</p>}

        {sessions?.length === 0 && (
          <div className={`${cardClass} p-8 text-center`}>
            <p className="text-sm text-muted">
              Nothing here yet. Sessions you create while signed in will appear here. Ones you made as a guest join
              your account the next time you open them while signed in.
            </p>
          </div>
        )}

        <ul className="grid gap-3">
          {sessions?.map((s) => (
            <li
              key={s.slug}
              className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
                  {s.has_password && <LockIcon size={13} className="shrink-0 text-amber-400" />}
                  <span className="truncate">{s.title}</span>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  <code className="text-neutral-400">{s.slug}</code> · {s.language} · edited{" "}
                  {formatDate(s.updated_at ?? s.created_at)} · {expiryLabel(s)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button onClick={() => copyLink(s.slug)}>{copied === s.slug ? "Copied!" : "Copy link"}</Button>
                <Button variant="primary" onClick={() => open(s.slug)} disabled={opening === s.slug}>
                  {opening === s.slug ? "Opening..." : "Open"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}