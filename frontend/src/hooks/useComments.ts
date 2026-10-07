import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type * as monaco from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

export interface CommentItem {
  id: string;
  anchor: unknown; // a Yjs relative position (JSON), so it follows the line when code moves
  text: string;
  name: string;
  color: string;
  authorKey: string;
  createdAt: number;
  line?: number; 
}

export interface PlacedComment extends CommentItem {
  line: number; // where the comment is right now
}

export interface CommentAuthor {
  name: string;
  color: string;
  authorKey: string;
}

interface Handlers {
  onAddRequest: (line: number) => void;
  onOpenLine: (line: number) => void;
}

const MAX_COMMENTS = 500;
const MAX_LENGTH = 500;

const sameLayout = (a: PlacedComment[], b: PlacedComment[]) =>
  a.length === b.length && a.every((c, i) => c.id === b[i].id && c.line === b[i].line);

export function useComments(
  doc: Y.Doc | null,
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monacoApi: Monaco | null,
  handlers: Handlers
) {
  const [raw, setRaw] = useState<CommentItem[]>([]);
  const [placed, setPlaced] = useState<PlacedComment[]>([]);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const linesRef = useRef<Set<number>>(new Set());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // 1) The shared list of comments
  useEffect(() => {
    if (!doc) return;
    const list = doc.getArray<CommentItem>("comments");
    const update = () => setRaw(list.toArray());
    list.observe(update);
    update();
    return () => list.unobserve(update);
  }, [doc]);

  // 2) Which line is each comment on right now? Re-checked whenever the code changes.
  useEffect(() => {
    if (!doc || !editor) {
      setPlaced([]);
      return;
    }
    let timer: number | undefined;

    const compute = () => {
      const model = editor.getModel();
      if (!model) return;
      const next = raw
        .map((comment) => {
          let line = 1;
          try {
            const abs = Y.createAbsolutePositionFromRelativePosition(
              Y.createRelativePositionFromJSON(comment.anchor),
              doc
            );
            if (abs) line = model.getPositionAt(Math.min(abs.index, model.getValueLength())).lineNumber;
          } catch {
            /* a damaged anchor: show it on line 1 */
          }
          return { ...comment, line };
        })
        .sort((a, b) => a.line - b.line || a.createdAt - b.createdAt);
      setPlaced((prev) => (sameLayout(prev, next) ? prev : next));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(compute, 30);
    };

    const subscription = editor.onDidChangeModelContent(schedule);
    compute();
    return () => {
      subscription.dispose();
      window.clearTimeout(timer);
    };
  }, [doc, editor, raw]);

  // 3) Gutter icons on commented lines
  useEffect(() => {
    if (!editor || !monacoApi) return;
    const counts = new Map<number, number>();
    placed.forEach((c) => counts.set(c.line, (counts.get(c.line) ?? 0) + 1));
    linesRef.current = new Set(counts.keys());

    const decorations = [...counts].map(([line, count]) => ({
      range: new monacoApi.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: "comment-line",
        glyphMarginClassName: "comment-glyph",
        glyphMarginHoverMessage: { value: `${count} comment${count === 1 ? "" : "s"}. Click to open.` },
      },
    }));

    if (!decorationsRef.current) decorationsRef.current = editor.createDecorationsCollection(decorations);
    else decorationsRef.current.set(decorations);
  }, [editor, monacoApi, placed]);

  useEffect(() => {
    return () => decorationsRef.current?.clear();
  }, []);

  // 4) Right-click menu entry, keyboard shortcut, and clicks on the gutter icon
  useEffect(() => {
    if (!editor || !monacoApi) return;

    const action = editor.addAction({
      id: "collab.add-comment",
      label: "Add comment on this line",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 1.5,
      keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyMod.Alt | monacoApi.KeyCode.KeyM],
      run: (ed) => handlersRef.current.onAddRequest(ed.getPosition()?.lineNumber ?? 1),
    });

    const mouse = editor.onMouseDown((event) => {
      const isGlyph = event.target.type === monacoApi.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;
      const line = event.target.position?.lineNumber;
      if (isGlyph && line && linesRef.current.has(line)) handlersRef.current.onOpenLine(line);
    });

    return () => {
      action.dispose();
      mouse.dispose();
    };
  }, [editor, monacoApi]);

  const add = useCallback(
    (line: number, text: string, author: CommentAuthor): boolean => {
      if (!doc || !editor) return false;
      const model = editor.getModel();
      const clean = text.trim().slice(0, MAX_LENGTH);
      if (!model || !clean) return false;

      const list = doc.getArray<CommentItem>("comments");
      if (list.length >= MAX_COMMENTS) return false;

      const lineNumber = Math.min(Math.max(1, Math.floor(line) || 1), model.getLineCount());
      const index = model.getOffsetAt({ lineNumber, column: 1 });
      const anchor = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(doc.getText("monaco"), index));
      list.push([
        { id: crypto.randomUUID(), anchor, text: clean, ...author, createdAt: Date.now(), line: lineNumber },
      ]);
      return true;
    },
    [doc, editor]
  );

  const remove = useCallback(
    (id: string) => {
      if (!doc) return;
      const list = doc.getArray<CommentItem>("comments");
      const index = list.toArray().findIndex((c) => c.id === id);
      if (index >= 0) list.delete(index, 1);
    },
    [doc]
  );

  return { comments: placed, add, remove };
}