import type { AwarenessUser } from "../../hooks/useAwareness";
import Popover from "../ui/Popover";
import Button from "../ui/Button";

interface ParticipantListProps {
  users: AwarenessUser[];
  myClientId?: number;
  followingId?: number | null;
  onToggleFollow?: (clientId: number) => void;
}

const MAX_AVATARS = 4;

function initials(name: string): string {
  const guest = /^Guest (\d+)$/.exec(name.trim());
  if (guest) return guest[1].slice(-2); 
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Avatar({ user }: { user: AwarenessUser }) {
  return (
    <span
      title={user.name}
      className="grid h-6 w-6 place-items-center rounded-full border-2 border-surface text-[10px] font-bold text-white"
      style={{ backgroundColor: user.color }} 
    >
      {initials(user.name)}
    </span>
  );
}

export default function ParticipantList({ users, myClientId, followingId, onToggleFollow }: ParticipantListProps) {
  const shown = users.slice(0, MAX_AVATARS);
  const extra = users.length - shown.length;

  return (
    <Popover
      label={`${users.length} online`}
      panelClassName="w-72 p-1"
      trigger={
        <span className="flex items-center gap-2">
          <span className="flex -space-x-2">
            {shown.map((u) => (
              <Avatar key={u.clientId} user={u} />
            ))}
            {extra > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-surface bg-neutral-600 px-1 text-[10px] font-bold text-white">
                +{extra}
              </span>
            )}
          </span>
          <span className="hidden text-xs text-muted sm:inline">{users.length} online</span>
        </span>
      }
    >
      {(close) => (
        <ul className="max-h-72 overflow-y-auto">
          {users.map((u) => {
            const isMe = u.clientId === myClientId;
            const following = followingId === u.clientId;
            return (
              <li key={u.clientId} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                <Avatar user={u} />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                  {u.name}
                  {isMe && <span className="ml-1 text-xs text-subtle">(you)</span>}
                </span>
                {!isMe && onToggleFollow && (
                  <Button
                    variant={following ? "primary" : "secondary"}
                    aria-pressed={following}
                    onClick={() => {
                      onToggleFollow(u.clientId);
                      close();
                    }}
                  >
                    {following ? "Following" : "Follow"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}