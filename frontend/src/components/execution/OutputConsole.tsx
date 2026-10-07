import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ExitInfo } from "../../lib/runSocket";
import type { RunStatus, Segment, SegmentKind } from "../../hooks/useCodeRunner";

interface OutputConsoleProps {
  segments: Segment[];
  status: RunStatus;
  summary: ExitInfo | null;
  onSubmitInput: (text: string) => void;
  onKill: () => void;
  onClear: () => void;
}

const COLORS: Record<SegmentKind, string> = {
  stdout: "#ddd",
  stderr: "#f87171",
  stdin: "#60a5fa", // what you typed
  info: "#888",
};

function describe(summary: ExitInfo): { text: string; failed: boolean } {
  if (summary.stage === "compile" && (summary.code !== 0 || summary.signal)) {
    return { text: "compile error", failed: true };
  }
  if (summary.signal) return { text: `stopped (${summary.signal})`, failed: true };
  return { text: `exit ${summary.code}`, failed: summary.code !== 0 };
}

export default function OutputConsole({
  segments, status, summary, onSubmitInput, onKill, onClear,
}: OutputConsoleProps) {
  const [line, setLine] = useState("");
  const bodyRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = status === "running";

  // Keep the newest output in view
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments]);

  // Put the cursor in the input as soon as a run starts
  useEffect(() => {
    if (running) inputRef.current?.focus();
  }, [running]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!running) return;
    onSubmitInput(line);
    setLine("");
  };

  const result = summary ? describe(summary) : null;

  return (
    <div
      style={{
        height: "220px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderTop: "1px solid #333", background: "#181818", color: "#ddd",
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "4px 12px", fontSize: "12px", borderBottom: "1px solid #2a2a2a", color: "#888",
        }}
      >
        <span>
          OUTPUT
          {running && <span style={{ marginLeft: "12px", color: "#fbbf24" }}>running...</span>}
          {!running && result && summary && (
            <span style={{ marginLeft: "12px", color: result.failed ? "#f87171" : "#4ade80" }}>
              {result.text} · {summary.durationMs}ms
            </span>
          )}
        </span>
        <span style={{ display: "flex", gap: "12px" }}>
          {running && (
            <button
              onClick={onKill}
              style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px" }}
            >
              ■ Stop
            </button>
          )}
          <button
            onClick={onClear}
            style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "12px" }}
          >
            Clear
          </button>
        </span>
      </div>

      <pre
        ref={bodyRef}
        style={{
          flex: 1, margin: 0, padding: "8px 12px", overflow: "auto", textAlign: "left",
          fontFamily: "Consolas, 'Courier New', monospace", fontSize: "13px", whiteSpace: "pre-wrap",
        }}
      >
        {segments.length === 0 && status === "idle" && (
          <span style={{ color: "#666" }}>Click Run to execute your code. If it asks for input, type it below.</span>
        )}
        {segments.map((s) => (
          <span key={s.id} style={{ color: COLORS[s.kind] }}>
            {s.text}
          </span>
        ))}
        {status === "finished" && segments.length === 0 && <span style={{ color: "#666" }}>(no output)</span>}
      </pre>

      <form
        onSubmit={submit}
        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderTop: "1px solid #2a2a2a" }}
      >
        <span style={{ color: running ? "#60a5fa" : "#555", fontFamily: "monospace" }}>›</span>
        <input
          ref={inputRef}
          value={line}
          disabled={!running}
          onChange={(e) => setLine(e.target.value)}
          placeholder={running ? "Type your input and press Enter" : "Input is available while the program runs"}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1, padding: "4px 6px", fontSize: "13px", fontFamily: "Consolas, 'Courier New', monospace",
            background: "transparent", color: "#fff", border: "none", outline: "none",
          }}
        />
      </form>
    </div>
  );
}