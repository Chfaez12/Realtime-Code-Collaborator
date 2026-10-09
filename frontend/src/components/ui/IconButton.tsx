import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // also used as the tooltip and the accessible name
  active?: boolean;
  badge?: number;
}

export default function IconButton({
  label,
  active,
  badge = 0,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "relative inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors md:h-8",
        active
          ? "border-accent bg-accent-soft text-blue-100"
          : "border-line bg-raised text-neutral-200 hover:bg-[#2d2d30]",
        className
      )}
      {...props}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}