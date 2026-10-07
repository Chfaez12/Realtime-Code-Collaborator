import { useEffect, useState } from "react";
import type * as Y from "yjs";

export type SessionStatus = "checking" | "valid" | "not-found";

export function useSessionValidity(doc: Y.Doc | null, isSynced: boolean, isOwner: boolean) {
  const [status, setStatus] = useState<SessionStatus>("checking");

  useEffect(() => {
    if (!doc || !isSynced) {
      setStatus("checking");
      return;
    }
    const settings = doc.getMap("settings");

    const check = () => {
      if (settings.has("createdAt")) {
        setStatus("valid");
      } else if (isOwner) {
        settings.set("createdAt", Date.now()); 
        setStatus("valid");
      } else {
        setStatus("not-found");
      }
    };

    settings.observe(check);
    check();
    return () => settings.unobserve(check);
  }, [doc, isSynced, isOwner]);

  return status;
}