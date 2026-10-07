import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types/message";
import type { AwarenessUser } from "../../hooks/useAwareness";

interface ChatPanelProps {
  messages: ChatMessage[];
  me: AwarenessUser | null;
  onSend: (msg: { clientId: number; name: string; color: string; text: string }) => void;
  onClose: () => void;
}

const MAX_LENGTH = 1000;

export default function ChatPanel({ messages, me, onSend, onClose }: ChatPanelProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !me) return;
    onSend({ clientId: me.clientId, name: me.name, color: me.color, text: trimmed.slice(0, MAX_LENGTH) });
    setText("");
    stickToBottom.current = true; 
  };

  const disabled = !text.trim() || !me;

  return (
    <div
      style={{
        width: "280px", display: "flex", flexDirection: "column",
        borderLeft: "1px solid #333", background: "#181818", color: "#ddd",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", fontSize: "12px", color: "#888", borderBottom: "1px solid #2a2a2a",
        }}
      >
        <span>CHAT</span>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" }}
        >
          ✕
        </button>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: "auto", padding: "8px 12px",
          display: "flex", flexDirection: "column", gap: "10px",
        }}
      >
        {messages.length === 0 && (
          <span style={{ fontSize: "12px", color: "#666" }}>No messages yet. Say hi!</span>
        )}
        {messages.map((m) => {
          const mine = m.clientId === me?.clientId;
          return (
            <div key={m.id} style={{ fontSize: "13px" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
                <span style={{ color: m.color, fontWeight: 600 }}>{mine ? "You" : m.name}</span>
                <span style={{ fontSize: "10px", color: "#666" }}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "6px", padding: "8px", borderTop: "1px solid #2a2a2a" }}>
        <input
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Type a message..."
          style={{
            flex: 1, minWidth: 0, padding: "6px 8px", fontSize: "13px",
            background: "#2a2a2a", color: "#fff", border: "1px solid #444", borderRadius: "4px",
          }}
        />
        <button
          onClick={submit}
          disabled={disabled}
          style={{
            padding: "6px 12px", fontSize: "12px", background: "#2563eb", color: "#fff",
            border: "none", borderRadius: "4px",
            cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}