import { getActiveOwnerToken } from "../hooks/useSession";
import { getStoredPassword } from "./sessionPassword";
import { getAccessToken } from "./supabaseClient";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface CreatedSession {
  slug: string;
  title: string;
  language: string;
  owner_token: string; 
}

export interface SessionInfo {
  slug: string;
  title: string;
  language: string;
  guests_can_edit: boolean;
  is_persistent: boolean;
  has_password: boolean;
  expires_at: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
  
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    let detail = `Request failed (${res.status})`;
    if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (Array.isArray(body?.detail)) {
      detail = body.detail
        .map((d: { msg?: string; loc?: unknown[] }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? "invalid"}`)
        .join("; ");
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function bearerHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createSession(input: { title?: string; language?: string } = {}) {
  return request<CreatedSession>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await bearerHeaders()) },
    body: JSON.stringify(input),
  });
}


export function getSession(slug: string) {
  return request<SessionInfo>(`/sessions/${encodeURIComponent(slug)}`);
}

export type Expiry = "never" | "1h" | "24h" | "7d" | "30d";

export interface SessionUpdateInput {
  title?: string;
  password?: string;
  remove_password?: boolean;
  expiry?: Expiry;
}

export function updateSession(slug: string, ownerToken: string, patch: SessionUpdateInput) {
  return request<SessionInfo>(`/sessions/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Owner-Token": ownerToken },
    body: JSON.stringify(patch),
  });
}

export function verifySessionPassword(slug: string, password: string) {
  return request<void>(`/sessions/${encodeURIComponent(slug)}/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}


export interface SnapshotMeta {
  id: string;
  label: string | null;
  is_manual: boolean;
  created_at: string;
  size: number; 
}

export interface SnapshotDetail extends SnapshotMeta {
  content: string;
}

function authHeaders(slug: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const ownerToken = getActiveOwnerToken(slug);
  if (ownerToken) headers["X-Owner-Token"] = ownerToken;
  const password = getStoredPassword(slug);
  
  if (password) headers["X-Session-Password"] = encodeURIComponent(password);
  return headers;
}

const snapshotsPath = (slug: string) => `/sessions/${encodeURIComponent(slug)}/snapshots`;

export function listSnapshots(slug: string) {
  return request<SnapshotMeta[]>(snapshotsPath(slug), { headers: authHeaders(slug) });
}

export function getSnapshot(slug: string, id: string) {
  return request<SnapshotDetail>(`${snapshotsPath(slug)}/${encodeURIComponent(id)}`, {
    headers: authHeaders(slug),
  });
}

export function createCheckpoint(slug: string, label: string) {
  return request<SnapshotMeta>(snapshotsPath(slug), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(slug) },
    body: JSON.stringify({ label }),
  });
}

export function restoreSnapshot(slug: string, id: string) {
  return request<void>(`${snapshotsPath(slug)}/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: authHeaders(slug),
  });
}

export interface MySession {
  slug: string;
  title: string;
  language: string;
  is_persistent: boolean;
  has_password: boolean;
  created_at: string;
  expires_at: string | null;
  updated_at: string | null;
}

export async function listMySessions() {
  return request<MySession[]>("/me/sessions", { headers: await bearerHeaders() });
}

export async function claimSession(slug: string, ownerToken: string) {
  return request<void>(`/sessions/${encodeURIComponent(slug)}/claim`, {
    method: "POST",
    headers: { "X-Owner-Token": ownerToken, ...(await bearerHeaders()) },
  });
}

export async function recoverOwnerToken(slug: string) {
  return request<{ owner_token: string }>(`/sessions/${encodeURIComponent(slug)}/owner-token`, {
    method: "POST",
    headers: await bearerHeaders(),
  });
}


export interface ServerExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  phase: "compile" | "run";
  duration_ms: number;
}

export function executeOnServer(
  slug: string,
  payload: { language: string; code: string; stdin?: string }
) {
  return request<ServerExecutionResult>(`/sessions/${encodeURIComponent(slug)}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(slug) },
    body: JSON.stringify(payload),
  });
}


export type GithubExportRequest =
  | { kind: "gist"; filename: string; description: string; public: boolean }
  | {
      kind: "repo";
      repository: string;
      path: string;
      branch?: string;
      message: string;
      include_private: boolean;
    };

export interface GithubExportResult {
  kind: "gist" | "repo";
  url: string;
  commit_url: string | null;
}

export function startGithubExport(slug: string, body: GithubExportRequest) {
  return request<{ authorize_url: string; state: string }>(
    `/sessions/${encodeURIComponent(slug)}/export/github/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(slug) },
      body: JSON.stringify(body),
    }
  );
}

export function finishGithubExport(slug: string, body: { state: string; finish_secret: string }) {
  return request<GithubExportResult>(`/sessions/${encodeURIComponent(slug)}/export/github/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(slug) },
    body: JSON.stringify(body),
  });
}