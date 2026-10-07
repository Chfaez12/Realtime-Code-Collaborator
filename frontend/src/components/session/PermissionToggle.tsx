interface PermissionToggleProps {
  isOwner: boolean;
  canEdit: boolean;
  onChange: (canEdit: boolean) => void;
}

export default function PermissionToggle({ isOwner, canEdit, onChange }: PermissionToggleProps) {
  
  if (!isOwner) {
    if (canEdit) return null;
    return (
      <span
        title="The session owner has turned off editing"
        style={{
          fontSize: "12px", padding: "4px 10px", borderRadius: "4px",
          background: "#422006", color: "#fbbf24", border: "1px solid #92400e",
        }}
      >
        🔒 View only
      </span>
    );
  }

  return (
    <button
      onClick={() => onChange(!canEdit)}
      title={canEdit ? "Click to make this session view-only for others" : "Click to allow others to edit"}
      style={{
        fontSize: "12px", padding: "4px 10px", borderRadius: "4px", cursor: "pointer",
        background: canEdit ? "#1e1e1e" : "#422006",
        color: canEdit ? "#fff" : "#fbbf24",
        border: `1px solid ${canEdit ? "#444" : "#92400e"}`,
      }}
    >
      {canEdit ? "✏️ Others can edit" : "🔒 View-only for others"}
    </button>
  );
}