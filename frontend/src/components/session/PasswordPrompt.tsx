import { useState } from "react";

interface PasswordPromptProps {
  onSubmit: (password: string) => Promise<void>;
  error: string | null;
}

export default function PasswordPrompt({ onSubmit, error }: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    await onSubmit(password);
    setBusy(false);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        width: "min(340px, 90vw)", display: "flex", flexDirection: "column", gap: "12px",
        background: "#181818", border: "1px solid #333", borderRadius: "8px", padding: "24px",
        textAlign: "left",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "18px" }}>🔒 Password required</h2>
      <p style={{ margin: 0, fontSize: "13px", color: "#aaa" }}>
        The owner protected this session with a password.
      </p>
      <input
        type="password"
        autoFocus
        value={password}
        maxLength={64}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        style={{
          padding: "8px 10px", fontSize: "14px", background: "#2a2a2a", color: "#fff",
          border: "1px solid #444", borderRadius: "4px",
        }}
      />
      {error && (
        <div role="alert" style={{ fontSize: "13px", color: "#f87171" }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!password || busy}
        style={{
          padding: "8px", fontSize: "14px", background: "#2563eb", color: "#fff", border: "none",
          borderRadius: "4px", cursor: !password || busy ? "not-allowed" : "pointer",
          opacity: !password || busy ? 0.6 : 1,
        }}
      >
        {busy ? "Checking..." : "Join session"}
      </button>
    </form>
  );
}