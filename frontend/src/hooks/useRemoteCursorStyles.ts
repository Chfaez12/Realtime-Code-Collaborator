import { useEffect } from "react";
import type { AwarenessUser } from "./useAwareness";

const STYLE_ID = "remote-cursor-styles";

// Awareness data comes from other clients, so treat it as untrusted before putting it in CSS
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : "#888888");
const safeName = (n: string) =>
  n.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 24) || "Guest";

export function useRemoteCursorStyles(users: AwarenessUser[]) {
  useEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }

    el.textContent = users
      .map((u) => {
        const color = safeColor(u.color);
        const name = safeName(u.name);
        return `
.yRemoteSelection-${u.clientId} {
  background-color: ${color};
  opacity: 0.3;
}
.yRemoteSelectionHead-${u.clientId} {
  position: relative;
  border-left: 2px solid ${color};
  height: 100%;
  box-sizing: border-box;
}
.yRemoteSelectionHead-${u.clientId}::after {
  content: "${name}";
  position: absolute;
  top: -1.5em;
  left: -2px;
  padding: 0 5px;
  background: ${color};
  color: #fff;
  font-size: 11px;
  line-height: 1.5;
  font-family: system-ui, sans-serif;
  border-radius: 3px 3px 3px 0;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}`;
      })
      .join("\n");
  }, [users]);

  // Remove the styles when the editor unmounts
  useEffect(() => {
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);
}