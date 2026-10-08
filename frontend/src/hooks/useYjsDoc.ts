import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { createYjsProvider } from "../lib/websocket";
import { getStoredPassword } from "../lib/sessionPassword";
import { getActiveOwnerToken } from "./useSession";

export function useYjsDoc(
  roomName: string,
  onAuthRejected?: () => void,
  displayName?: string,
  onSessionEnded?: () => void
) {
  const [state, setState] = useState<{ doc: Y.Doc | null; provider: WebsocketProvider | null }>({
    doc: null,
    provider: null,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Keep the latest values without reconnecting every time they change
  const rejectedRef = useRef(onAuthRejected);
  rejectedRef.current = onAuthRejected;
  const endedRef = useRef(onSessionEnded);
  endedRef.current = onSessionEnded;
  const nameRef = useRef(displayName);
  nameRef.current = displayName;

  useEffect(() => {
    const { doc, provider } = createYjsProvider(roomName, {
      ownerToken: getActiveOwnerToken(roomName),
      password: getStoredPassword(roomName),
      getDisplayName: () => nameRef.current,
      onAuthRejected: () => rejectedRef.current?.(),
      onSessionEnded: () => endedRef.current?.(),
    });
    const onStatus = ({ status }: { status: string }) => setIsConnected(status === "connected");
    const onSync = (synced: boolean) => setIsSynced(synced);

    provider.on("status", onStatus);
    provider.on("sync", onSync);
    setState({ doc, provider });

    return () => {
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      provider.destroy();
      doc.destroy();
      setState({ doc: null, provider: null });
      setIsConnected(false);
      setIsSynced(false);
    };
  }, [roomName]);

  return { ...state, isConnected, isSynced };
}