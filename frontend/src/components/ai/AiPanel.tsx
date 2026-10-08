import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { AiChatApi } from "../../hooks/useAiChat";
import type { AiReviewApi } from "../../hooks/useAiReview";
import AiMessageBody from "./AiMessageBody";

interface AiPanelProps {
  chat: AiChatApi;
  review: AiReviewApi;
  getSelection: () => { text: string; startLine: number } | null;
  canInsert: boolean;
  onInsert: (code: string) => void;
  onJump: (line: number) => void;
  onClose: () => void;
}

type Tab = "chat" | "review";

const SEVERITY_COLORS = { error: "#f87171", warning: "#fbbf24", info: "#60a5fa" } as const;

const quickButton: CSSProperties = {
  background: "#202020", border: "1px solid #3a3a3a", color: "#ccc", borderRadius: "12px",
  padding: "2px 8px", fontSize: "11px", cursor: "pointer",
};

const QUICK_QUESTIONS = [
  "Explain what this code does, step by step.",
  "Find bugs or problems in this code.",
  "How can I improve this code?",
];

export default function AiPanel({ chat, review, getSelection, canInsert, onInsert, onJump, onClose }: AiPanelProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const [draft, setDraft] = useState("");
  const [includeSelection, setIncludeSelection] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat.entries]);

  const send = (question: string) => {
    const selection = includeSelection ? getSelection() : null;
    stickToBottom.current = true;
    chat.ask(question, selection ?? undefined);
  };

  const submit = () => {
    if (!draft.trim() || chat.busy) return;
    send(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    flex: 1, padding: "6px", fontSize: "12px", cursor: "pointer", background: "transparent", border: "none",
    color: active ? "#fff" : "#888", borderBottom: `2px solid ${active ? "#2563eb" : "transparent"}`,
  });

  return (
    <div
      style={{
        width: "340px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderLeft: "1px solid #333", background: "#181818", color: "#ddd", textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #2a2a2a" }}>
        <button onClick={() => setTab("chat")} style={tabStyle(tab === "chat")}>✨ Assistant</button>
        <button onClick={() => setTab("review")} style={tabStyle(tab === "review")}>🔍 Review</button>
        <button
          onClick={onClose}
          aria-label="Close AI panel"
          style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "14px", padding: "0 10px" }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "6px 12px", fontSize: "11px", color: "#777", borderBottom: "1px solid #232323" }}>
        Your code is sent to an AI service to answer. AI can make mistakes, so check anything important.
      </div>

      {tab === "chat" ? (
        <>
          <div
            ref={listRef}
            onScroll={() => {
              const el = listRef.current;
              if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
            style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {chat.entries.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#777" }}>Ask anything about the code in this session.</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => send(q)} disabled={chat.busy} style={quickButton}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {chat.entries.map((entry) => (
              <div key={entry.id}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: entry.role === "user" ? "#60a5fa" : "#a78bfa", marginBottom: "2px" }}>
                  {entry.role === "user" ? "You" : "Assistant"}
                </div>
                {entry.role === "assistant" && !entry.content && chat.busy ? (
                  <span style={{ fontSize: "12px", color: "#777", fontStyle: "italic" }}>Thinking...</span>
                ) : entry.error ? (
                  <div style={{ fontSize: "13px", color: "#f87171", whiteSpace: "pre-wrap" }}>{entry.content}</div>
                ) : entry.role === "assistant" ? (
                  <AiMessageBody content={entry.content} canInsert={canInsert} onInsert={onInsert} />
                ) : (
                  <div style={{ fontSize: "13px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.content}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "8px", borderTop: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#888", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeSelection}
                onChange={(e) => setIncludeSelection(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              Include the code I have selected
            </label>
            <textarea
              value={draft}
              maxLength={4000}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about the code (Enter to send)"
              style={{
                resize: "none", padding: "6px 8px", fontSize: "13px", background: "#2a2a2a", color: "#fff",
                border: "1px solid #444", borderRadius: "4px", fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
              <button onClick={chat.clear} style={{ ...quickButton, borderRadius: "4px" }}>New chat</button>
              {chat.busy ? (
                <button onClick={chat.stop} style={{ padding: "4px 12px", fontSize: "12px", background: "#7f1d1d", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                  ■ Stop
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!draft.trim()}
                  style={{
                    padding: "4px 12px", fontSize: "12px", background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: "4px", cursor: draft.trim() ? "pointer" : "not-allowed", opacity: draft.trim() ? 1 : 0.5,
                  }}
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={review.run}
              disabled={review.busy}
              style={{
                flex: 1, padding: "6px", fontSize: "12px", background: "#2563eb", color: "#fff", border: "none",
                borderRadius: "4px", cursor: review.busy ? "not-allowed" : "pointer", opacity: review.busy ? 0.6 : 1,
              }}
            >
              {review.busy ? "Reviewing..." : "Review the code"}
            </button>
            {(review.result || review.error) && (
              <button onClick={review.clear} style={{ ...quickButton, borderRadius: "4px" }}>Clear</button>
            )}
          </div>

          {review.error && <div role="alert" style={{ fontSize: "13px", color: "#f87171" }}>{review.error}</div>}

          {!review.result && !review.error && !review.busy && (
            <span style={{ fontSize: "12px", color: "#777" }}>
              The AI looks for bugs, crashes, security problems and other real issues, and marks them in the editor.
            </span>
          )}

          {review.result && (
            <>
              <div style={{ fontSize: "13px" }}>{review.result.summary}</div>
              {review.result.truncated && (
                <div style={{ fontSize: "11px", color: "#fbbf24" }}>This file is long, so only the first part was reviewed.</div>
              )}
              {review.result.findings.length === 0 && (
                <div style={{ fontSize: "12px", color: "#4ade80" }}>No problems found.</div>
              )}
              {review.result.findings.map((f, i) => (
                <div key={i} style={{ border: "1px solid #2a2a2a", borderLeft: `3px solid ${SEVERITY_COLORS[f.severity]}`, borderRadius: "4px", padding: "6px 8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{f.title}</span>
                    <button onClick={() => onJump(f.line)} style={{ ...quickButton, borderRadius: "4px", flexShrink: 0 }}>
                      line {f.line}
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: SEVERITY_COLORS[f.severity], textTransform: "uppercase", margin: "2px 0" }}>
                    {f.severity}
                  </div>
                  <div style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{f.explanation}</div>
                  {f.suggestion && (
                    <div style={{ fontSize: "12px", color: "#9ca3af", whiteSpace: "pre-wrap", marginTop: "4px" }}>
                      Fix: {f.suggestion}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}