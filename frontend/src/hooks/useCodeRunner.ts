import { useCallback, useEffect, useRef, useState } from "react";
import { startRun, type ExitInfo, type RunController } from "../lib/runSocket";

export type SegmentKind = "stdout" | "stderr" | "stdin" | "info";

export interface Segment {
  id: number;
  kind: SegmentKind;
  text: string;
}

export type RunStatus = "idle" | "running" | "finished";

const MAX_CHARS = 200_000; // keeps the console from growing without limit

export function useCodeRunner(sessionId: string, languageId: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [summary, setSummary] = useState<ExitInfo | null>(null);

  const controllerRef = useRef<RunController | null>(null);
  const runIdRef = useRef(0);
  const nextIdRef = useRef(1);
  const statusRef = useRef<RunStatus>("idle");

  const updateStatus = useCallback((next: RunStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const append = useCallback((kind: SegmentKind, text: string) => {
    if (!text) return;
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      let next: Segment[];
      if (last && last.kind === kind && kind !== "stdin") {
        next = [...prev.slice(0, -1), { ...last, text: last.text + text }];
      } else {
        next = [...prev, { id: nextIdRef.current++, kind, text }];
      }
      let total = next.reduce((sum, s) => sum + s.text.length, 0);
      while (total > MAX_CHARS && next.length > 1) {
        total -= next[0].text.length;
        next = next.slice(1);
      }
      return next;
    });
  }, []);

  const run = useCallback(
    (code: string) => {
      controllerRef.current?.close();
      const runId = ++runIdRef.current;
      const active = () => runIdRef.current === runId;

      setSegments([]);
      setSummary(null);
      updateStatus("running");

      controllerRef.current = startRun(
        { sessionId, language: languageId, code },
        {
          onStage: (stage) => {
            if (active() && stage === "compile") append("info", "Compiling...\n");
          },
          onData: (stream, data) => {
            if (active()) append(stream, data);
          },
          onExit: (info) => {
            if (!active()) return;
            if (info.stage === "compile" && info.code === 0 && !info.signal) return;
            setSummary(info);
            updateStatus("finished");
          },
          onError: (message) => {
            if (!active()) return;
            append("stderr", `${message}\n`);
            updateStatus("finished");
          },
          onClose: () => {
            if (!active()) return;
            if (statusRef.current === "running") {
              append("info", "\nConnection closed.\n");
              updateStatus("finished");
            }
          },
        }
      );
    },
    [sessionId, languageId, append, updateStatus]
  );

  const sendInput = useCallback(
    (text: string) => {
      if (statusRef.current !== "running") return;
      controllerRef.current?.sendInput(text + "\n");
      append("stdin", text + "\n"); // the program doesn't echo input, so show what was typed
    },
    [append]
  );

  const kill = useCallback(() => controllerRef.current?.kill(), []);

  const clear = useCallback(() => {
    setSegments([]);
    setSummary(null);
  }, []);

  // Stop everything when the editor closes
  useEffect(() => {
    return () => {
      runIdRef.current++;
      controllerRef.current?.close();
    };
  }, []);

  return { segments, status, summary, run, sendInput, kill, clear };
}