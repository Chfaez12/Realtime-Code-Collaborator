import type { LanguageOption } from "../utils/languages";
import { executeOnServer } from "./sessionsApi";

// Set VITE_USE_MOCK_EXECUTION=true to run JavaScript in the browser without any backend
const USE_BROWSER_FALLBACK = import.meta.env.VITE_USE_MOCK_EXECUTION === "true";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  phase: "compile" | "run";
  durationMs: number;
}

// ---------- Browser-only JavaScript fallback (Web Worker) ----------

const WORKER_SOURCE = `
  const fmt = (args) =>
    args
      .map((v) => {
        if (typeof v === "string") return v;
        try {
          return typeof v === "object" && v !== null ? JSON.stringify(v, null, 2) : String(v);
        } catch {
          return String(v);
        }
      })
      .join(" ");

  let out = "";
  let err = "";
  console.log = (...a) => { out += fmt(a) + "\\n"; };
  console.info = console.log;
  console.debug = console.log;
  console.warn = console.log;
  console.error = (...a) => { err += fmt(a) + "\\n"; };

  self.onmessage = async (e) => {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      await new AsyncFunction(e.data)();
      postMessage({ stdout: out, stderr: err, exitCode: 0 });
    } catch (ex) {
      const msg = ex && ex.stack ? ex.stack : String(ex);
      postMessage({ stdout: out, stderr: err + msg + "\\n", exitCode: 1 });
    }
  };
`;

function runJavaScriptInBrowser(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);

    const finish = (r: Omit<ExecutionResult, "phase" | "durationMs">) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ ...r, phase: "run", durationMs: Math.round(performance.now() - started) });
    };

    const timer = setTimeout(
      () => finish({ stdout: "", stderr: "Execution timed out after 5 seconds (infinite loop?)\n", exitCode: 124 }),
      5000
    );

    worker.onmessage = (e) => finish(e.data);
    worker.onerror = (e) => finish({ stdout: "", stderr: `${e.message}\n`, exitCode: 1 });
    worker.postMessage(code);
  });
}

// ---------- Public API ----------

export async function runCode(
  language: LanguageOption,
  code: string,
  options: { sessionId: string; stdin?: string }
): Promise<ExecutionResult> {
  if (USE_BROWSER_FALLBACK) {
    if (language.monacoId === "javascript") return runJavaScriptInBrowser(code);
    throw new Error(
      `${language.label} needs the execution server. Set VITE_USE_MOCK_EXECUTION=false and start Piston.`
    );
  }

  const result = await executeOnServer(options.sessionId, {
    language: language.monacoId,
    code,
    stdin: options.stdin ?? "",
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exit_code,
    phase: result.phase,
    durationMs: result.duration_ms,
  };
}