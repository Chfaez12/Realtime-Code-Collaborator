import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ExitInfo } from "../../lib/runSocket";
import type { RunStatus, Segment, SegmentKind } from "../../hooks/useCodeRunner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { cn } from "../../utils/cn";
import { ChevronIcon, StopIcon, TerminalIcon } from "../ui/Icons";

interface OutputConsoleProps {
  segments: Segment[];
  status: RunStatus;
  summary: ExitInfo | null;
  onSubmitInput: (text: string) => void;
  onKill: () => void;
  onClear: () => void;
}

const COLORS: Record<SegmentKind, string> = {
  stdout: "text-neutral-200",
  stderr: "text-red-400",
  stdin: "text-blue-400", // what you typed
  info: "text-neutral-500",
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
  const isWide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(isWide); // collapsed by default on small screens
  const [line, setLine] = useState("");
  const bodyRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = status === "running";

  // A new run opens the console
  useEffect(() => {
    if (running) setOpen(true);
  }, [running]);

  // Keep the newest output in view
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments, open]);

  // Put the cursor in the input as soon as a run starts
  useEffect(() => {
    if (running && open) inputRef.current?.focus();
  }, [running, open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!running) return;
    onSubmitInput(line);
    setLine("");
  };

  const result = summary ? describe(summary) : null;

  return (
    <section className="shrink-0 border-t border-line bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-muted">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 rounded px-1 py-1 hover:text-neutral-200"
        >
          <ChevronIcon size={14} className={cn("transition-transform", !open && "-rotate-90")} />
          <TerminalIcon size={14} />
          <span className="font-medium tracking-wide">OUTPUT</span>
          {running && <span className="text-amber-400">running...</span>}
          {!running && result && summary && (
            <span className={result.failed ? "text-red-400" : "text-emerald-400"}>
              {result.text} · {summary.durationMs}ms
            </span>
          )}
        </button>
        <div className="flex items-center gap-3">
          {running && (
            <button type="button" onClick={onKill} className="flex items-center gap-1 text-red-400 hover:text-red-300">
              <StopIcon size={12} />
              Stop
            </button>
          )}
          <button type="button" onClick={onClear} className="hover:text-neutral-200">
            Clear
          </button>
        </div>
      </div>

      {open && (
        <>
          <pre
            ref={bodyRef}
            className="m-0 h-36 overflow-auto px-3 py-2 text-left font-mono text-[13px] leading-relaxed whitespace-pre-wrap md:h-52"
          >
            {segments.length === 0 && status === "idle" && (
              <span className="text-subtle">Click Run to execute your code. If it asks for input, type it below.</span>
            )}
            {segments.map((s) => (
              <span key={s.id} className={COLORS[s.kind]}>
                {s.text}
              </span>
            ))}
            {status === "finished" && segments.length === 0 && <span className="text-subtle">(no output)</span>}
          </pre>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-line-soft px-3 py-1.5">
            <span className={cn("font-mono", running ? "text-blue-400" : "text-subtle")}>›</span>
            <input
              ref={inputRef}
              value={line}
              disabled={!running}
              onChange={(e) => setLine(e.target.value)}
              placeholder={running ? "Type your input and press Enter" : "Input is available while the program runs"}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-1 font-mono text-[13px] text-neutral-100 placeholder:text-subtle focus:outline-none disabled:opacity-60"
            />
          </form>
        </>
      )}
    </section>
  );
}