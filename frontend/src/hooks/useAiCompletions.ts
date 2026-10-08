import { useEffect, useState } from "react";
import type * as monaco from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { requestCompletion } from "../lib/aiApi";
import { LANGUAGES } from "../utils/languages";

const PAUSE_MS = 450; // wait for a pause in typing before asking
const MIN_CONTEXT_CHARS = 8;

interface Options {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monacoApi: Monaco | null;
  sessionId: string;
  enabled: boolean;
}

// Returns a short message when suggestions can't be fetched (for example a missing API key)
export function useAiCompletions({ editor, monacoApi, sessionId, enabled }: Options): string | null {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !editor || !monacoApi) {
      setProblem(null);
      return;
    }

    const empty = { items: [] as { insertText: string; range: monaco.Range }[] };

    const provider = {
      async provideInlineCompletions(
        model: monaco.editor.ITextModel,
        position: monaco.Position,
        _context: unknown,
        token: monaco.CancellationToken
      ) {
        // Only for the main editor, not for the History diff viewer
        if (model !== editor.getModel()) return empty;
        if (editor.getOption(monacoApi.editor.EditorOption.readOnly)) return empty;

        await new Promise<void>((resolve) => setTimeout(resolve, PAUSE_MS));
        if (token.isCancellationRequested) return empty;

        const text = model.getValue();
        const offset = model.getOffsetAt(position);
        const before = text.slice(Math.max(0, offset - 4000), offset);
        const after = text.slice(offset, offset + 1500);
        if (before.trim().length < MIN_CONTEXT_CHARS) return empty;

        // In the middle of a word? Wait until the word is finished.
        if (/\w/.test(model.getLineContent(position.lineNumber).charAt(position.column - 1))) return empty;

        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());

        try {
          const completion = await requestCompletion(
            sessionId,
            { language: model.getLanguageId(), before, after },
            controller.signal
          );
          setProblem((current) => (current === null ? current : null));
          if (!completion || token.isCancellationRequested) return empty;
          return {
            items: [
              {
                insertText: completion,
                range: new monacoApi.Range(position.lineNumber, position.column, position.lineNumber, position.column),
              },
            ],
          };
        } catch (err) {
          if (!controller.signal.aborted) {
            setProblem(err instanceof Error ? err.message : "AI suggestions are unavailable.");
          }
          return empty;
        }
      },
      freeInlineCompletions() {},
      disposeInlineCompletions() {},
    } as unknown as monaco.languages.InlineCompletionsProvider;

    const disposables = LANGUAGES.map((lang) =>
      monacoApi.languages.registerInlineCompletionsProvider(lang.monacoId, provider)
    );
    return () => disposables.forEach((d) => d.dispose());
  }, [enabled, editor, monacoApi, sessionId]);

  return problem;
}