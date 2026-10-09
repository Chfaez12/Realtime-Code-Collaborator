import { useState, type FormEvent } from "react";
import Button from "../ui/Button";
import { LockIcon } from "../ui/Icons";
import { cardClass, inputClass } from "../ui/styles";

interface PasswordPromptProps {
  onSubmit: (password: string) => Promise<void>;
  error: string | null;
}

export default function PasswordPrompt({ onSubmit, error }: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    await onSubmit(password);
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className={`${cardClass} flex w-full flex-col gap-4 p-6 text-left`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-blue-200">
          <LockIcon size={18} />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Password required</h1>
          <p className="text-sm text-muted">The owner protected this session.</p>
        </div>
      </div>
      <input
        type="password"
        autoFocus
        value={password}
        maxLength={64}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className={inputClass}
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="md" disabled={!password || busy}>
        {busy ? "Checking..." : "Join session"}
      </Button>
    </form>
  );
}