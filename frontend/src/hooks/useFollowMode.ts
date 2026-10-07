import { useCallback, useEffect, useState } from "react";
import type * as monaco from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import type { WebsocketProvider } from "y-websocket";

const PUBLISH_DELAY_MS = 80;

export function useFollowMode(
  provider: WebsocketProvider | null,
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monacoApi: Monaco | null
) {
  const [followingId, setFollowingId] = useState<number | null>(null);

  // 1) Publish which line is at the top of my editor, so others can follow me
  useEffect(() => {
    if (!provider || !editor) return;
    const awareness = provider.awareness;
    let timer: number | undefined;

    const publish = () => {
      const top = editor.getVisibleRanges()[0]?.startLineNumber ?? 1;
      const current = (awareness.getLocalState() as { view?: { top?: number } } | null)?.view?.top;
      if (current !== top) awareness.setLocalStateField("view", { top });
    };
    const schedule = () => {
      if (timer === undefined) {
        timer = window.setTimeout(() => {
          timer = undefined;
          publish();
        }, PUBLISH_DELAY_MS);
      }
    };

    const subscription = editor.onDidScrollChange(schedule);
    publish();

    return () => {
      subscription.dispose();
      if (timer !== undefined) window.clearTimeout(timer);
      try {
        awareness.setLocalStateField("view", null);
      } catch {
        /* the connection is already closed */
      }
    };
  }, [provider, editor]);

  // 2) While following someone, copy their view
  useEffect(() => {
    if (followingId === null || !provider || !editor || !monacoApi) return;
    const awareness = provider.awareness;
    let lastApplied: number | null = null;

    const apply = () => {
      const state = awareness.getStates().get(followingId) as { view?: { top?: number } } | undefined;
      if (!state) {
        setFollowingId(null); // they left the session
        return;
      }
      const top = state.view?.top;
      if (typeof top !== "number" || top === lastApplied) return;
      lastApplied = top;
      const lastLine = editor.getModel()?.getLineCount() ?? 1;
      editor.revealLineNearTop(Math.min(Math.max(1, top), lastLine), monacoApi.editor.ScrollType.Immediate);
    };

    // Any move of your own stops it: scrolling, clicking, or typing in the editor
    const stop = () => setFollowingId(null);
    const dom = editor.getDomNode();
    dom?.addEventListener("wheel", stop, { passive: true });
    dom?.addEventListener("pointerdown", stop);
    dom?.addEventListener("keydown", stop);

    awareness.on("change", apply);
    apply();

    return () => {
      awareness.off("change", apply);
      dom?.removeEventListener("wheel", stop);
      dom?.removeEventListener("pointerdown", stop);
      dom?.removeEventListener("keydown", stop);
    };
  }, [followingId, provider, editor, monacoApi]);

  const toggle = useCallback((clientId: number) => {
    setFollowingId((current) => (current === clientId ? null : clientId));
  }, []);
  const stop = useCallback(() => setFollowingId(null), []);

  return { followingId, toggle, stop };
}