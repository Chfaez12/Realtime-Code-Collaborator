import type { AwarenessUser } from "../../hooks/useAwareness";

interface ParticipantListProps {
  users: AwarenessUser[];
  myClientId?: number;
  followingId?: number | null;
  onToggleFollow?: (clientId: number) => void;
}

export default function ParticipantList({
  users, myClientId, followingId, onToggleFollow,
}: ParticipantListProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 8px" }}>
      <span style={{ fontSize: "12px", color: "#888" }}>{users.length} online:</span>
      {users.map((u) => {
        const isMe = u.clientId === myClientId;
        const following = followingId === u.clientId;
        return (
          <div key={u.clientId} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
            <span
              style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: u.color, display: "inline-block",
              }}
            />
            {u.name}
            {isMe && <span style={{ color: "#666" }}>(you)</span>}
            {!isMe && onToggleFollow && (
              <button
                onClick={() => onToggleFollow(u.clientId)}
                title={following ? `Stop following ${u.name}` : `Follow ${u.name}`}
                aria-pressed={following}
                style={{
                  padding: "0 4px", fontSize: "12px", cursor: "pointer", borderRadius: "3px",
                  background: following ? "#1e3a8a" : "transparent",
                  border: `1px solid ${following ? "#60a5fa" : "#444"}`,
                  color: following ? "#bfdbfe" : "#aaa",
                }}
              >
                👁
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}