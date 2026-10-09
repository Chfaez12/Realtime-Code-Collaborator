import Button from "../ui/Button";
import { PlayIcon } from "../ui/Icons";

interface RunButtonProps {
  onClick: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export default function RunButton({ onClick, isRunning, disabled }: RunButtonProps) {
  return (
    <Button variant="success" onClick={onClick} disabled={isRunning || disabled}>
      {isRunning ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Running
        </>
      ) : (
        <>
          <PlayIcon size={12} />
          Run
        </>
      )}
    </Button>
  );
}