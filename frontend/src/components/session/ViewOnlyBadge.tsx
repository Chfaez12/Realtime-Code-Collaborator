import { LockIcon } from "../ui/Icons";

interface ViewOnlyBadgeProps {
  isOwner: boolean;
  canEdit: boolean;
}

export default function ViewOnlyBadge({ isOwner, canEdit }: ViewOnlyBadgeProps) {
  if (canEdit) return null;
  return (
    <span
      title={isOwner ? "Guests can't edit. Change this in the menu." : "The session owner has turned off editing"}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-700/60 bg-amber-950/60 px-2 py-1 text-xs text-amber-300"
    >
      <LockIcon size={12} />
      {isOwner ? "View-only for guests" : "View only"}
    </span>
  );
}