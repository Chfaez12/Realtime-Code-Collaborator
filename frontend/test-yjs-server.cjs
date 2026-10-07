const WebSocket = require("ws");
const http = require("http");
const Y = require("yjs");
const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const docs = new Map();

function send(conn, buf) {
  if (conn.readyState === WebSocket.OPEN) conn.send(buf);
}

function getDoc(name) {
  if (docs.has(name)) return docs.get(name);

  const doc = new Y.Doc();
  doc.conns = new Map(); // conn -> Set of awareness clientIDs it controls
  doc.awareness = new awarenessProtocol.Awareness(doc);
  doc.awareness.setLocalState(null);

  // Broadcast document updates to everyone except the sender
  doc.on("update", (update, origin) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const buf = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, c) => {
      if (c !== origin) send(c, buf);
    });
  });

  // Broadcast awareness (presence, cursors) to everyone
  doc.awareness.on("update", ({ added, updated, removed }, origin) => {
    const owned = doc.conns.get(origin);
    if (owned) {
      added.forEach((id) => owned.add(id));
      removed.forEach((id) => owned.delete(id));
    }
    const changed = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changed)
    );
    const buf = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, c) => send(c, buf));
  });

  docs.set(name, doc);
  return doc;
}

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on("connection", (conn, req) => {
  const roomName = req.url.slice(1).split("?")[0] || "default";
  const doc = getDoc(roomName);
  conn.binaryType = "arraybuffer";
  doc.conns.set(conn, new Set());

  conn.on("message", (message) => {
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const type = decoding.readVarUint(decoder);

    if (type === MSG_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
      if (encoding.length(encoder) > 1) send(conn, encoding.toUint8Array(encoder));
    } else if (type === MSG_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(
        doc.awareness,
        decoding.readVarUint8Array(decoder),
        conn
      );
    }
  });

  conn.on("close", () => {
    const owned = doc.conns.get(conn);
    doc.conns.delete(conn);
    if (owned) {
      awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(owned), null);
    }
  });

  // Initial sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(conn, encoding.toUint8Array(encoder));

  // Send everyone who is already here
  const states = doc.awareness.getStates();
  if (states.size > 0) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys()))
    );
    send(conn, encoding.toUint8Array(enc));
  }
});

server.listen(1234, () => console.log("Yjs test server on ws://localhost:1234"));