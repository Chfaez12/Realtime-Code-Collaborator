import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { CodeIcon } from "../components/ui/Icons";
import { inputClass } from "../components/ui/styles";
import { getDisplayName, useAuth } from "../hooks/useAuth";
import { saveOwnerToken } from "../hooks/useSession";
import { createSession } from "../lib/sessionsApi";

const FEATURES = ["Live cursors", "Run code", "Version history", "Inline comments", "AI assistant"];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSession();
      saveOwnerToken(session.slug, session.owner_token);
      navigate(`/s/${session.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the session");
      setCreating(false);
    }
  };

  const handleJoin = () => {
    const slug = input.trim().split("/").filter(Boolean).pop(); // accepts a full link or a bare ID
    if (slug) navigate(`/s/${slug}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <nav className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">
            <CodeIcon size={16} />
          </span>
          Code Collaborator
        </span>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden max-w-40 truncate text-muted sm:inline">{getDisplayName(user)}</span>
              <Link to="/dashboard" className="text-blue-400 hover:underline">
                Dashboard
              </Link>
              <Button onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <Link to="/login" className="text-blue-400 hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 pb-20 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Code together, in real time</h1>
          <p className="mx-auto mt-4 max-w-md text-base text-muted sm:text-lg">
            Share a link and edit the same code at once. Run it, review it, and keep its history.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleCreate} disabled={creating} className="w-full max-w-xs">
          {creating ? "Creating..." : "Create a session"}
        </Button>

        {error && (
          <p role="alert" className="max-w-sm text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Paste a link or session ID"
            aria-label="Session link or ID"
            className={inputClass}
          />
          <Button size="md" onClick={handleJoin}>
            Join
          </Button>
        </div>

        <ul className="flex flex-wrap justify-center gap-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
              {feature}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}