import { getActiveOwnerToken } from "../hooks/useSession";
import { getStoredPassword } from "./sessionPassword";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
// http -> ws and https -> wss, so it follows the API address automatically
const RUN_WS_URL: string = import.meta.env.VITE_RUN_WS_URL ?? `${API_URL.replace(/^http/, "ws")}/ws/run`;

export interface ExitInfo {
  stage: "compile" | "run";
  code: number | null;
  signal: string | null;
  durationMs: number;
}

export interface RunHandlers {
  onStage: (stage: "compile" | "run") => void;
  onData: (stream: "stdout" | "stderr", data: string) => void;
  onExit: (info: ExitInfo) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export interface RunController {
  sendInput: (text: string) => void;
  kill: () => void;
  close: () => void;
}

export function startRun(
  params: { sessionId: string; language: string; code: string },
  handlers: RunHandlers
): RunController {
  const ws = new WebSocket(`${RUN_WS_URL}/${encodeURIComponent(params.sessionId)}`);
  let reportedError = false;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "start",
        language: params.language,
        code: params.code,
        owner_token: getActiveOwnerToken(params.sessionId),
        password: getStoredPassword(params.sessionId),
      })
    );
  };

  ws.onmessage = (event) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    switch (msg.type) {
      case "stage":
        handlers.onStage(msg.stage as "compile" | "run");
        break;
      case "data":
        handlers.onData(msg.stream as "stdout" | "stderr", String(msg.data ?? ""));
        break;
      case "exit":
        handlers.onExit({
          stage: msg.stage as "compile" | "run",
          code: (msg.code as number | null) ?? null,
          signal: (msg.signal as string | null) ?? null,
          durationMs: Number(msg.duration_ms ?? 0),
        });
        break;
      case "error":
        reportedError = true;
        handlers.onError(String(msg.message ?? "Something went wrong"));
        break;
    }
  };

  ws.onerror = () => {
    if (!reportedError) {
      reportedError = true;
      handlers.onError("Could not reach the execution server. Is the backend running?");
    }
  };

  ws.onclose = () => handlers.onClose();

  const send = (payload: object) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  };

  return {
    sendInput: (text) => send({ type: "stdin", data: text }),
    kill: () => send({ type: "kill" }),
    close: () => {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      ws.close();
    },
  };
}