import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";

export function usePermissions(doc: Y.Doc | null) {
  const [canEdit, setCanEditState] = useState(true);

  useEffect(() => {
    if (!doc) return;
    const settings = doc.getMap("settings");

    const update = () => setCanEditState(settings.get("canEdit") !== false);

    settings.observe(update);
    update();
    return () => settings.unobserve(update);
  }, [doc]);

  const setCanEdit = useCallback(
    (value: boolean) => {
      doc?.getMap("settings").set("canEdit", value);
    },
    [doc]
  );

  return { canEdit, setCanEdit };
}