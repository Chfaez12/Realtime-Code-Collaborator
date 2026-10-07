interface RunButtonProps {
  onClick: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export default function RunButton({ onClick, isRunning, disabled }: RunButtonProps) {
  const inactive = isRunning || disabled;
  return (
    <button
      onClick={onClick}
      disabled={inactive}
      style={{
        fontSize: "12px",
        padding: "4px 12px",
        backgroundColor: inactive ? "#166534" : "#16a34a",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: inactive ? "not-allowed" : "pointer",
        opacity: inactive ? 0.7 : 1,
      }}
    >
      {isRunning ? "Running..." : "▶ Run"}
    </button>
  );
}