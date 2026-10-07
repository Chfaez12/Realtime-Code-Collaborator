import { useEffect, useState } from "react";
import { getActiveOwnerToken } from "../../hooks/useSession";
import {
  getSession,
  updateSession,
  type Expiry,
  type SessionInfo,
  type SessionUpdateInput,
} from "../../lib/sessionsApi";

interface SessionSettingsProps {
  sessionId: string;
  onClose: () => void;
}

type ExpiryChoice = "keep" | Expiry;

const label: React.CSSProperties = { fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" };
const field: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: "13px",
  background: "#2a2a2a", color: "#fff", border: "1px solid #444", borderRadius: "4px",
};

function describeExpiry(info: SessionInfo): string {
  if (info.expires_at) return `Expires ${new Date(info.expires_at).toLocaleString()}`;
  if (info.is_persistent) return "Never expires";
  return "No expiry set";
}

export default function SessionSettings({ sessionId, onClose }: SessionSettingsProps) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>("keep");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSession(sessionId)
      .then(setInfo)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Could not load settings"));
  }, [sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    const token = getActiveOwnerToken(sessionId);
    if (!token) {
      setMessage({ kind: "error", text: "Only the session owner can change settings." });
      return;
    }

    const patch: SessionUpdateInput = {};
    if (removePassword) {
      patch.remove_password = true;
    } else if (password) {
      if (password.length < 4) {
        setMessage({ kind: "error", text: "The password must be at least 4 characters." });
        return;
      }
      patch.password = password;
    }
    if (expiry !== "keep") patch.expiry = expiry;

    if (Object.keys(patch).length === 0) {
      setMessage({ kind: "ok", text: "Nothing to change." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateSession(sessionId, token, patch);
      setInfo(updated);
      setPassword("");
      setRemovePassword(false);
      setExpiry("keep");
      setMessage({ kind: "ok", text: "Settings saved." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not save settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session settings"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)", background: "#1e1e1e", color: "#fff", textAlign: "left",
          border: "1px solid #444", borderRadius: "8px", padding: "20px",
          display: "flex", flexDirection: "column", gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Session settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "18px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {loadError && <div style={{ color: "#f87171", fontSize: "13px" }}>{loadError}</div>}
        {!info && !loadError && <div style={{ color: "#888", fontSize: "13px" }}>Loading...</div>}

        {info && (
          <>
            <div>
              <label htmlFor="session-password" style={label}>
                Password {info.has_password ? "(currently set)" : "(none)"}
              </label>
              <input
                id="session-password"
                type="password"
                value={password}
                disabled={removePassword}
                maxLength={64}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={info.has_password ? "Enter a new password to change it" : "Set a password"}
                autoComplete="new-password"
                style={{ ...field, opacity: removePassword ? 0.5 : 1 }}
              />
              {info.has_password && (
                <label style={{ ...label, marginTop: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={removePassword}
                    onChange={(e) => setRemovePassword(e.target.checked)}
                    style={{ marginRight: "6px" }}
                  />
                  Remove the password
                </label>
              )}
            </div>

            <div>
              <label htmlFor="session-expiry" style={label}>
                Expiry: {describeExpiry(info)}
              </label>
              <select
                id="session-expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}
                style={field}
              >
                <option value="keep">Keep as is</option>
                <option value="never">Never expires</option>
                <option value="1h">Expire in 1 hour</option>
                <option value="24h">Expire in 24 hours</option>
                <option value="7d">Expire in 7 days</option>
                <option value="30d">Expire in 30 days</option>
              </select>
            </div>

            {message && (
              <div
                role={message.kind === "error" ? "alert" : "status"}
                style={{ fontSize: "13px", color: message.kind === "error" ? "#f87171" : "#4ade80" }}
              >
                {message.text}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "6px 14px", fontSize: "13px", background: "transparent", color: "#ccc",
                  border: "1px solid #555", borderRadius: "4px", cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "6px 14px", fontSize: "13px", background: "#2563eb", color: "#fff",
                  border: "none", borderRadius: "4px", cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}