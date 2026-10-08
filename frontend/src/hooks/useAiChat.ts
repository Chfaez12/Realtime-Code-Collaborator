import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat, type AiTurn } from "../lib/aiApi";

export interface ChatEntry {
  id: number;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

export function useAiChat(sessionId: string, language: string) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  const ask = useCallback(
    async (question: string, selection?: { text: string; startLine: number }) => {
      const text = question.trim();
      if (!text || busy) return;

      // The conversation so far (without failed turns), ending with the new question
      const history: AiTurn[] = [
        ...entriesRef.current
          .filter((e) => !e.error && e.content)
          .map(({ role, content }) => ({ role, content })),
        { role: "user" as const, content: text },
      ].slice(-20);
      while (history.length > 0 && history[0].role !== "user") history.shift();

      const replyId = nextId.current + 1;
      const userEntry: ChatEntry = { id: nextId.current, role: "user", content: text };
      nextId.current += 2;
      setEntries((prev) => [...prev, userEntry, { id: replyId, role: "assistant", content: "" }]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          sessionId,
          {
            language,
            messages: history,
            selection: selection?.text,
            selection_start_line: selection?.startLine,
          },
          (delta) =>
            setEntries((prev) => prev.map((e) => (e.id === replyId ? { ...e, content: e.content + delta } : e))),
          controller.signal
        );
      } catch (err) {
        if (controller.signal.aborted) return; // stopped by the user: keep what arrived
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setEntries((prev) =>
          prev.map((e) =>
            e.id === replyId ? { ...e, error: true, content: e.content ? `${e.content}\n\n${message}` : message } : e
          )
        );
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, sessionId, language]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setEntries([]);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { entries, busy, ask, stop, clear };
}

export type AiChatApi = ReturnType<typeof useAiChat>;