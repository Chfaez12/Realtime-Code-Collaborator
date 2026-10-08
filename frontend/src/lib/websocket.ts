import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebsocketProvider } from "y-websocket";
import { getAccessToken } from "./supabaseClient";
import { peekStoredName } from "../utils/userIdentity";

// y-websocket connects to `${url}/${roomName}`, so the final address is
// ws://localhost:8000/ws/<slug>, which is the route in the backend's sync/server.py
const YJS_SERVER_URL: string = import.meta.env.VITE_YJS_URL ?? "ws://localhost:8000/ws";

// Our own message types (the standard Yjs ones are 0-3). Must match sync/guard.py.
const MESSAGE_OWNER_AUTH = 100;
const MESSAGE_PASSWORD = 101;
const MESSAGE_IDENTITY = 102;

// Close codes sent by the server
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_NOT_FOUND = 4404;
const CLOSE_EXPIRED = 4410;

interface ProviderOptions {
  ownerToken?: string | null;
  password?: string | null;
  getDisplayName?: () => string | undefined;
  onAuthRejected?: () => void;
  onSessionEnded?: () => void; // the session expired or was deleted
}

export function createYjsProvider(roomName: string, options: ProviderOptions = {}) {
  const { ownerToken, password, getDisplayName, onAuthRejected, onSessionEnded } = options;
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(YJS_SERVER_URL, roomName, doc);

  // Sent on every (re)connect, before y-websocket sends its own first messages
  provider.on("status", ({ status }: { status: string }) => {
    const ws = provider.ws;
    if (status !== "connected" || !ws) return;

    const send = (type: number, text: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, type);
      encoding.writeVarString(encoder, text);
      ws.send(encoding.toUint8Array(encoder));
    };

    if (ownerToken) send(MESSAGE_OWNER_AUTH, ownerToken);
    if (password) send(MESSAGE_PASSWORD, password);

    // Who is this? The login token, if there is one, lets the server record the real account.
    getAccessToken()
      .catch(() => null)
      .then((token) => {
        const name = getDisplayName?.() || peekStoredName() || undefined;
        send(MESSAGE_IDENTITY, JSON.stringify({ name, token }));
      });
  });

  provider.on("connection-close", (event: CloseEvent | null) => {
    const code = event?.code;
    if (code === CLOSE_UNAUTHORIZED) {
      // Wrong or changed password: stop retrying and tell the page
      provider.disconnect();
      onAuthRejected?.();
    } else if (code === CLOSE_EXPIRED || code === CLOSE_NOT_FOUND) {
      // The session is gone: stop retrying and tell the page
      provider.disconnect();
      onSessionEnded?.();
    }
  });

  return { doc, provider };
}