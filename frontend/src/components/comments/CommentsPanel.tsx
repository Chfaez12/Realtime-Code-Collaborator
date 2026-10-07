import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PlacedComment } from "../../hooks/useComments";

interface CommentsPanelProps {
  comments: PlacedComment[];
  myKey: string;
  isOwner: boolean;
  composerLine: number;
  onComposerLineChange: (line: number) => void;
  focusTick: number; // changes whenever the composer should take focus
  selection: { line: number; tick: number } | null; // a line to scroll to
  getLineText: (line: number) => string;
  onAdd: (line: number, text: string) => boolean;
  onDelete: (id: string) => void;
  onJump: (line: number) => void;
  onClose: () => void;
}

const MAX_LENGTH = 500;

export default function CommentsPanel({
  comments, myKey, isOwner, composerLine, onComposerLineChange, focusTick, selection,
  getLineText, onAdd, onDelete, onJump, onClose,
}: CommentsPanelProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const groupRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const groups = useMemo(() => {
    const byLine = new Map<number, PlacedComment[]>();
    comments.forEach((c) => byLine.set(c.line, [...(byLine.get(c.line) ?? []), c]));
    return [...byLine.entries()].sort((a, b) => a[0] - b[0]);
  }, [comments]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusTick]);

  useEffect(() => {
    if (selection) groupRefs.current.get(selection.line)?.scrollIntoView({ block: "nearest" });
  }, [selection]);

  const submit = () => {
    if (onAdd(composerLine, text)) setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      style={{
        width: "280px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderLeft: "1px solid #333", background: "#181818", color: "#ddd", textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", fontSize: "12px", color: "#888", borderBottom: "1px solid #2a2a2a",
        }}
      >
        <span>COMMENTS ({comments.length})</span>
        <button
          onClick={onClose}
          aria-label="Close comments"
          style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {groups.length === 0 && (
          <span style={{ fontSize: "12px", color: "#666" }}>
            No comments yet. Right-click a line and choose "Add comment on this line", press Ctrl+Alt+M,
            or write one below.
          </span>
        )}

        {groups.map(([line, items]) => (
          <div
            key={line}
            ref={(el) => {
              if (el) groupRefs.current.set(line, el);
              else groupRefs.current.delete(line);
            }}
            style={{
              border: `1px solid ${selection?.line === line ? "#2563eb" : "#2a2a2a"}`,
              borderRadius: "6px", overflow: "hidden",
            }}
          >
            <button
              onClick={() => onJump(line)}
              title="Go to this line"
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "6px 8px", cursor: "pointer",
                background: "#202020", border: "none", color: "#9ca3af", fontSize: "11px",
                fontFamily: "Consolas, 'Courier New', monospace",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              Line {line}: {getLineText(line).trim().slice(0, 40) || "(empty line)"}
            </button>

            {items.map((c) => (
              <div key={c.id} style={{ padding: "6px 8px", borderTop: "1px solid #232323", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ color: c.color, fontWeight: 600 }}>{c.name}</span>
                  <span style={{ fontSize: "10px", color: "#666" }}>
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {(c.authorKey === myKey || isOwner) && (
                      <button
                        onClick={() => onDelete(c.id)}
                        title="Delete comment"
                        style={{
                          marginLeft: "8px", background: "transparent", border: "none",
                          color: "#888", cursor: "pointer", fontSize: "11px",
                        }}
                      >
                        delete
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.text}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: "8px", borderTop: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "11px", color: "#888", display: "flex", alignItems: "center", gap: "6px" }}>
          Comment on line
          <input
            type="number"
            min={1}
            value={composerLine}
            onChange={(e) => onComposerLineChange(Math.max(1, Number(e.target.value) || 1))}
            style={{
              width: "60px", padding: "2px 4px", fontSize: "12px", background: "#2a2a2a",
              color: "#fff", border: "1px solid #444", borderRadius: "4px",
            }}
          />
        </label>
        <textarea
          ref={textareaRef}
          value={text}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a comment (Enter to send, Shift+Enter for a new line)"
          style={{
            resize: "none", padding: "6px 8px", fontSize: "13px", background: "#2a2a2a",
            color: "#fff", border: "1px solid #444", borderRadius: "4px", fontFamily: "inherit",
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          style={{
            padding: "6px", fontSize: "12px", background: "#2563eb", color: "#fff", border: "none",
            borderRadius: "4px", cursor: text.trim() ? "pointer" : "not-allowed", opacity: text.trim() ? 1 : 0.5,
          }}
        >
          Add comment
        </button>
      </div>
    </div>
  );
}