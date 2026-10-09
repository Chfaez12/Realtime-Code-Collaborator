import type { ReactNode } from "react";
import Popover from "./Popover";
import { CheckIcon } from "./Icons";

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  checked?: boolean; // shows a tick when true, and an empty slot when false
  hidden?: boolean;
  disabled?: boolean;
}

interface DropdownMenuProps {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
}

export default function DropdownMenu({ label, trigger, items }: DropdownMenuProps) {
  const visible = items.filter((item) => !item.hidden);

  return (
    <Popover label={label} trigger={trigger} panelClassName="w-60 py-1">
      {(close) => (
        <div role="menu">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.checked}
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-neutral-200 hover:bg-white/10 disabled:opacity-50 md:py-2"
            >
              <span className="grid w-4 place-items-center text-muted">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.checked !== undefined && (
                <span className="grid w-4 place-items-center text-emerald-400">
                  {item.checked && <CheckIcon size={14} />}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}