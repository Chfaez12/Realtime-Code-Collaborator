import { ApiError, authHeaders } from "./sessionsApi";
import { getAccessToken } from "./supabaseClient";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Finding {
  line: number;
  severity: "error" | "warning" | "info";
  title: string;
  explanation: string;
  suggestion: string;
}

export interface ReviewResult {
  summary: string;
  findings: Finding[];
  truncated: boolean;
}

const path = (slug: string, tail: string) => `${API_URL}/sessions/${encodeURIComponent(slug)}/ai/${tail}`;

async function headers(slug: string): Promise<Record<string, string>> {
  const result: Record<string, string> = { "Content-Type": "application/json", ...authHeaders(slug) };
  const token = await getAccessToken();
  if (token) result.Authorization = `Bearer ${token}`; // lets the server record who asked
  return result;
}

async function failure(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const detail = typeof body?.detail === "string" ? body.detail : `Request failed (${res.status})`;
  return new ApiError(res.status, detail);
}

async function post(slug: string, tail: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path(slug, tail), {
      method: "POST",
      headers: await headers(slug),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  }
  if (!res.ok) throw await failure(res);
  return res;
}

// The answer arrives as lines of JSON: {"t":"delta","text":...}, then {"t":"done"} or {"t":"error",...}
export async function streamChat(
  slug: string,
  body: {
    language: string;
    messages: AiTurn[];
    selection?: string;
    selection_start_line?: number;
  },
  onDelta: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await post(slug, "chat", body, signal);
  if (!res.body) throw new ApiError(0, "This browser can't show streaming answers.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string) => {
    if (!line.trim()) return;
    let event: { t?: string; text?: string; message?: string };
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.t === "delta" && event.text) onDelta(event.text);
    else if (event.t === "error") throw new ApiError(502, event.message ?? "The AI could not answer.");
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  handle(buffer);
}

export async function reviewCode(slug: string, language: string): Promise<ReviewResult> {
  const res = await post(slug, "review", { language });
  return (await res.json()) as ReviewResult;
}

export async function requestCompletion(
  slug: string,
  body: { language: string; before: string; after: string },
  signal: AbortSignal
): Promise<string> {
  const res = await post(slug, "complete", body, signal);
  const data = (await res.json()) as { completion?: string };
  return data.completion ?? "";
}