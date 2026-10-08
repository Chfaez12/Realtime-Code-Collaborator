import { useCallback, useEffect, useState } from "react";
import type * as monaco from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { reviewCode, type ReviewResult } from "../lib/aiApi";

const MARKER_OWNER = "ai-review";

export function useAiReview(
  sessionId: string,
  language: string,
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monacoApi: Monaco | null
) {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearMarkers = useCallback(() => {
    const model = editor?.getModel();
    if (model && monacoApi) monacoApi.editor.setModelMarkers(model, MARKER_OWNER, []);
  }, [editor, monacoApi]);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await reviewCode(sessionId, language);
      setResult(response);

      const model = editor?.getModel();
      if (model && monacoApi) {
        const severity = {
          error: monacoApi.MarkerSeverity.Error,
          warning: monacoApi.MarkerSeverity.Warning,
          info: monacoApi.MarkerSeverity.Info,
        };
        monacoApi.editor.setModelMarkers(
          model,
          MARKER_OWNER,
          response.findings.map((f) => {
            const line = Math.min(Math.max(1, f.line), model.getLineCount());
            return {
              startLineNumber: line,
              endLineNumber: line,
              startColumn: 1,
              endColumn: model.getLineMaxColumn(line),
              message: `${f.title}\n${f.explanation}`,
              severity: severity[f.severity],
              source: "AI review",
            };
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The review failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, sessionId, language, editor, monacoApi]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    clearMarkers();
  }, [clearMarkers]);

  useEffect(() => () => clearMarkers(), [clearMarkers]);

  return { result, busy, error, run, clear };
}

export type AiReviewApi = ReturnType<typeof useAiReview>;