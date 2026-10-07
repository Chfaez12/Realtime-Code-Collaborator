import { useState, type FormEvent } from "react";
import type { SnapshotMeta } from "../../lib/sessionsApi";

interface SnapshotTimelineProps {
  snapshots: SnapshotMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isOwner: boolean;
  busy: boolean;
  onCreate: (label: string) => Promise<void>;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SnapshotTimeline({
  snapshots, selectedId, onSelect, isOwner, busy, onCreate,
}: SnapshotTimelineProps) {
  const [label, setLabel] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || busy) return;
    await onCreate(trimmed);
    setLabel("");
  };

  return (
    <div
      style={{
        width: "280px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid #333", minHeight: 0,
      }}
    >
      {isOwner && (
        <form onSubmit={submit} style={{ display: "flex", gap: "6px", padding: "10px", borderBottom: "1px solid #2a2a2a" }}>
          <input
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name this version..."
            style={{
              flex: 1, minWidth: 0, padding: "6px 8px", fontSize: "12px", background: "#2a2a2a",
              color: "#fff", border: "1px solid #444", borderRadius: "4px",
            }}
          />
          <button
            type="submit"
            disabled={!label.trim() || busy}
            style={{
              padding: "6px 10px", fontSize: "12px", background: "#2563eb", color: "#fff", border: "none",
              borderRadius: "4px", cursor: !label.trim() || busy ? "not-allowed" : "pointer",
              opacity: !label.trim() || busy ? 0.5 : 1,
            }}
          >
            Save
          </button>
        </form>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {snapshots.length === 0 && (
          <div style={{ padding: "12px", fontSize: "12px", color: "#666" }}>
            No versions yet. They are saved automatically while you work{isOwner ? ", or name one above" : ""}.
          </div>
        )}
        {snapshots.map((s) => {
          const selected = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px", cursor: "pointer",
                background: selected ? "#2a2d3a" : "transparent", color: "#ddd",
                border: "none", borderBottom: "1px solid #232323",
                borderLeft: `3px solid ${selected ? "#2563eb" : "transparent"}`,
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: s.is_manual ? 600 : 400 }}>
                {s.is_manual ? `★ ${s.label ?? "Checkpoint"}` : "Auto-saved"}
              </div>
              <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                {formatTime(s.created_at)} · {s.size.toLocaleString()} chars
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}