import { DiffEditor } from "@monaco-editor/react";

interface DiffViewerProps {
  snapshotId: string;
  original: string; // the saved version
  modified: string; // the code as it is now
  language: string;
  title: string;
  canRestore: boolean;
  busy: boolean;
  onRestore: () => void;
}

export default function DiffViewer({
  snapshotId, original, modified, language, title, canRestore, busy, onRestore,
}: DiffViewerProps) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", borderBottom: "1px solid #2a2a2a", fontSize: "12px", color: "#aaa",
        }}
      >
        <span>
          <strong style={{ color: "#ddd" }}>{title}</strong> (left) compared with the current code (right)
        </span>
        {canRestore && (
          <button
            onClick={onRestore}
            disabled={busy}
            style={{
              padding: "4px 12px", fontSize: "12px", background: "#b45309", color: "#fff", border: "none",
              borderRadius: "4px", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >
            Restore this version
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DiffEditor
          key={snapshotId}
          height="100%"
          theme="vs-dark"
          language={language}
          original={original}
          modified={modified}
          options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}