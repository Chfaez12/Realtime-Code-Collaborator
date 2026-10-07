import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCheckpoint,
  getSnapshot,
  listSnapshots,
  restoreSnapshot,
  type SnapshotDetail,
  type SnapshotMeta,
} from "../../lib/sessionsApi";
import DiffViewer from "./DiffViewer";
import SnapshotTimeline from "./SnapshotTimeline";

interface HistoryModalProps {
  sessionId: string;
  isOwner: boolean;
  language: string;
  getCurrentCode: () => string;
  onClose: () => void;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

export default function HistoryModal({ sessionId, isOwner, language, getCurrentCode, onClose }: HistoryModalProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [current, setCurrent] = useState(() => getCurrentCode());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The parent passes a new function every render; keep the latest without re-running effects
  const getCodeRef = useRef(getCurrentCode);
  getCodeRef.current = getCurrentCode;

  const reload = useCallback(
    async (selectId?: string) => {
      try {
        const list = await listSnapshots(sessionId);
        setSnapshots(list);
        setSelectedId(selectId ?? list[0]?.id ?? null);
        setError(null);
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // Load the selected version and refresh the "current code" side of the diff
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setCurrent(getCodeRef.current());
    getSnapshot(sessionId, selectedId)
      .then((d) => active && setDetail(d))
      .catch((err) => active && setError(errorText(err)));
    return () => {
      active = false;
    };
  }, [sessionId, selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveCheckpoint = async (label: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const created = await createCheckpoint(sessionId, label);
      await reload(created.id);
      setNotice("Version saved.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!detail) return;
    const ok = window.confirm(
      "Replace the current code with this version?\n\nThe code as it is now is saved as a version first, so you can undo this."
    );
    if (!ok) return;

    setBusy(true);
    setNotice(null);
    try {
      await restoreSnapshot(sessionId, detail.id);
      await reload();
      setNotice("Version restored. The previous code was saved as a version first.");
      setTimeout(() => setCurrent(getCodeRef.current()), 500); // let the change reach the editor
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const title = detail ? (detail.is_manual ? detail.label ?? "Checkpoint" : "Auto-saved version") : "";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 94vw)", height: "min(700px, 88vh)", background: "#1e1e1e", color: "#fff",
          border: "1px solid #444", borderRadius: "8px", display: "flex", flexDirection: "column",
          overflow: "hidden", textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderBottom: "1px solid #333",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Version history</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "18px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {(error || notice) && (
          <div
            role={error ? "alert" : "status"}
            style={{
              padding: "8px 16px", fontSize: "13px",
              background: error ? "#450a0a" : "#052e16", color: error ? "#f87171" : "#4ade80",
            }}
          >
            {error ?? notice}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <SnapshotTimeline
            snapshots={snapshots}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isOwner={isOwner}
            busy={busy}
            onCreate={saveCheckpoint}
          />
          {loading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
              Loading history...
            </div>
          ) : detail ? (
            <DiffViewer
              snapshotId={detail.id}
              original={detail.content}
              modified={current}
              language={language}
              title={title}
              canRestore={isOwner}
              busy={busy}
              onRestore={restore}
            />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: "13px" }}>
              Select a version to compare it with the current code.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}