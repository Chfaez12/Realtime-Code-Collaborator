import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import CodeEditor from "../components/editor/CodeEditor";
import PasswordPrompt from "../components/session/PasswordPrompt";
import Button from "../components/ui/Button";
import { isSessionOwner } from "../hooks/useSession";
import { clearStoredPassword, getStoredPassword, storePassword } from "../lib/sessionPassword";
import { ApiError, getSession, verifySessionPassword } from "../lib/sessionsApi";
import { getDisplayName, useAuth } from "../hooks/useAuth";
import { useClaimSession } from "../hooks/useClaimSession";

type Status = "loading" | "needs-password" | "ok" | "not-found" | "expired" | "error";

const PASSWORD_CHANGED = "This session's password has changed. Please enter it again.";

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 text-center text-neutral-200">
      <div className="flex w-full max-w-sm flex-col items-center gap-3">{children}</div>
    </div>
  );
}

export default function EditorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); 
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

  // The session expired or was deleted while this page was open
  const handleSessionEnded = useCallback(() => {
    setStatus("expired");
  }, []);

  if (!sessionId) return <Navigate to="/" replace />;

  if (status === "ok") {
    return (
      <CodeEditor
        roomName={sessionId}
        displayName={getDisplayName(user)}
        onAuthRejected={handleAuthRejected}
        onSessionEnded={handleSessionEnded}
      />
    );
  }

  if (status === "needs-password") {
    return (
      <Screen>
        <PasswordPrompt onSubmit={submitPassword} error={passwordError} />
      </Screen>
    );
  }

  return (
    <Screen>
      {status === "loading" && (
        <>
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
          <span className="text-sm text-muted">Loading session...</span>
        </>
      )}
      {status === "not-found" && (
        <>
          <h1 className="text-xl font-semibold">Session not found</h1>
          <p className="text-sm text-muted">This session doesn't exist. Check the link, or create a new one.</p>
        </>
      )}
      {status === "expired" && (
        <>
          <h1 className="text-xl font-semibold">Session expired</h1>
          <p className="text-sm text-muted">This session has expired and its data was deleted.</p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-xl font-semibold">Can't load the session</h1>
          <p className="text-sm text-red-400">{message}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        </>
      )}
      {status !== "loading" && (
        <Link to="/" className="text-sm text-blue-400 hover:underline">
          Back to home
        </Link>
      )}
    </Screen>
  );
}