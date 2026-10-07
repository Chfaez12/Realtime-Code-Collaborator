import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDisplayName, useAuth } from "../hooks/useAuth";
import { saveOwnerToken } from "../hooks/useSession";
import { createSession } from "../lib/sessionsApi";

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
    <div
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "24px",
        background: "#1e1e1e", color: "#fff", position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute", top: 16, right: 16, fontSize: "13px",
          display: "flex", gap: "12px", alignItems: "center",
        }}
      >
        {user ? (
          <>
            <span style={{ color: "#aaa" }}>{getDisplayName(user)}</span>
            <Link to="/dashboard" style={{ color: "#60a5fa" }}>Dashboard</Link>
            <button
              onClick={signOut}
              style={{
                background: "transparent", border: "1px solid #555", color: "#fff",
                borderRadius: "4px", padding: "4px 10px", cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" style={{ color: "#60a5fa" }}>Sign in</Link>
        )}
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 600 }}>Realtime Code Collaborator</h1>

      <button
        onClick={handleCreate}
        disabled={creating}
        style={{
          padding: "12px 24px", borderRadius: "6px", border: "none",
          background: "#2563eb", color: "#fff", fontSize: "16px",
          cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
        }}
      >
        {creating ? "Creating..." : "Create session"}
      </button>

      {error && (
        <div role="alert" style={{ fontSize: "13px", color: "#f87171", maxWidth: "360px", textAlign: "center" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="Paste link or session ID"
          style={{
            width: "280px", padding: "8px 12px", borderRadius: "6px",
            border: "1px solid #444", background: "#2a2a2a", color: "#fff",
          }}
        />
        <button
          onClick={handleJoin}
          style={{
            padding: "8px 16px", borderRadius: "6px", border: "1px solid #555",
            background: "transparent", color: "#fff", cursor: "pointer",
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}