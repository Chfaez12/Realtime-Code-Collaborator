import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import CodeEditor from "../components/editor/CodeEditor";
import PasswordPrompt from "../components/session/PasswordPrompt";
import { isSessionOwner } from "../hooks/useSession";
import { clearStoredPassword, getStoredPassword, storePassword } from "../lib/sessionPassword";
import { ApiError, getSession, verifySessionPassword } from "../lib/sessionsApi";
import { getDisplayName, useAuth } from "../hooks/useAuth";
import { useClaimSession } from "../hooks/useClaimSession";


type Status = "loading" | "needs-password" | "ok" | "not-found" | "expired" | "error";

const PASSWORD_CHANGED = "This session's password has changed. Please enter it again.";

export default function EditorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bump to retry
  const { user } = useAuth();
  useClaimSession(sessionId, status === "ok");

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setStatus("loading");

    (async () => {
      try {
        const info = await getSession(sessionId);
        if (!active) return;

        // Owners skip the password. Everyone else needs one if the session has one.
        if (info.has_password && !isSessionOwner(sessionId)) {
          const saved = getStoredPassword(sessionId);
          if (!saved) {
            setPasswordError(null);
            setStatus("needs-password");
            return;
          }
          // Check the remembered password now, so a changed password shows the prompt immediately
          try {
            await verifySessionPassword(sessionId, saved);
          } catch (err) {
            if (!active) return;
            if (err instanceof ApiError && err.status === 401) {
              clearStoredPassword(sessionId);
              setPasswordError(PASSWORD_CHANGED);
              setStatus("needs-password");
              return;
            }
            throw err;
          }
        }

        if (active) setStatus("ok");
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setStatus("not-found");
        else if (err instanceof ApiError && err.status === 410) setStatus("expired");
        else {
          setMessage(err instanceof Error ? err.message : "Something went wrong");
          setStatus("error");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [sessionId, attempt]);

  const submitPassword = async (password: string) => {
    if (!sessionId) return;
    setPasswordError(null);
    try {
      await verifySessionPassword(sessionId, password);
      storePassword(sessionId, password);
      setStatus("ok");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not check the password");
    }
  };

  // The server refused our saved password mid-session (for example after a reconnect)
  const handleAuthRejected = useCallback(() => {
    if (!sessionId) return;
    clearStoredPassword(sessionId);
    setPasswordError(PASSWORD_CHANGED);
    setStatus("needs-password");
  }, [sessionId]);

  if (!sessionId) return <Navigate to="/" replace />;

  if (status === "ok") {
    return (
      <div style={{ height: "100vh" }}>
      <CodeEditor
        roomName={sessionId}
        displayName={getDisplayName(user)}
        onAuthRejected={handleAuthRejected}
      />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "12px",
        background: "#1e1e1e", color: "#fff", textAlign: "center",
      }}
    >
      {status === "loading" && <span style={{ color: "#888" }}>Loading session...</span>}
      {status === "needs-password" && (
        <PasswordPrompt onSubmit={submitPassword} error={passwordError} />
      )}
      {status === "not-found" && (
        <>
          <h2 style={{ margin: 0 }}>Session not found</h2>
          <p style={{ margin: 0, color: "#aaa", fontSize: "14px" }}>
            This session doesn't exist. Check the link, or create a new one.
          </p>
        </>
      )}
      {status === "expired" && (
        <>
          <h2 style={{ margin: 0 }}>Session expired</h2>
          <p style={{ margin: 0, color: "#aaa", fontSize: "14px" }}>This session is no longer available.</p>
        </>
      )}
      {status === "error" && (
        <>
          <h2 style={{ margin: 0 }}>Can't load the session</h2>
          <p style={{ margin: 0, color: "#f87171", fontSize: "14px" }}>{message}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            style={{
              padding: "6px 14px", borderRadius: "4px", border: "1px solid #555",
              background: "transparent", color: "#fff", cursor: "pointer",
            }}
          >
            Try again
          </button>
        </>
      )}
      {status !== "loading" && (
        <Link to="/" style={{ color: "#60a5fa", fontSize: "14px" }}>
          Back to home
        </Link>
      )}
    </div>
  );
}