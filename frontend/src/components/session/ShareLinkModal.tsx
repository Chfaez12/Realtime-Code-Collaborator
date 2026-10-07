import { useEffect, useRef, useState } from "react";

interface ShareLinkModalProps {
  sessionId: string;
  onClose: () => void;
}

export default function ShareLinkModal({ sessionId, onClose }: ShareLinkModalProps) {
  const link = `${window.location.origin}/s/${sessionId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator.share === "function";

  // Close on Escape, and pre-select the link so it's easy to copy manually
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    inputRef.current?.select();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Reset the "Copied!" label after a moment
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard API can be blocked (e.g. non-HTTPS); fall back to the old way
      inputRef.current?.select();
      setCopied(document.execCommand("copy"));
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "Join my coding session", url: link });
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share session"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(460px, 90vw)", background: "#1e1e1e", color: "#fff",
          border: "1px solid #444", borderRadius: "8px", padding: "20px",
          display: "flex", flexDirection: "column", gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Share this session</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "18px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "13px", color: "#aaa" }}>
          Anyone with this link can join and edit. No account needed.
        </p>

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            ref={inputRef}
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1, minWidth: 0, padding: "8px 10px", fontSize: "13px",
              background: "#2a2a2a", color: "#fff", border: "1px solid #444", borderRadius: "4px",
            }}
          />
          <button
            onClick={copy}
            style={{
              padding: "8px 14px", fontSize: "13px", border: "none", borderRadius: "4px",
              cursor: "pointer", color: "#fff", minWidth: "76px",
              background: copied ? "#16a34a" : "#2563eb",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#888" }}>
          <span>
            Session ID: <code style={{ color: "#ccc" }}>{sessionId}</code>
          </span>
          {canNativeShare && (
            <button
              onClick={nativeShare}
              style={{
                padding: "4px 10px", fontSize: "12px", background: "transparent",
                color: "#ccc", border: "1px solid #555", borderRadius: "4px", cursor: "pointer",
              }}
            >
              Share...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}