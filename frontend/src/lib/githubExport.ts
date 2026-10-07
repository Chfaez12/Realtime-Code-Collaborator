import {
  finishGithubExport,
  startGithubExport,
  type GithubExportRequest,
  type GithubExportResult,
} from "./sessionsApi";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const BACKEND_ORIGIN = new URL(API_URL).origin;

const WAIT_LIMIT_MS = 10 * 60 * 1000;

// Waits for the GitHub window to report back. Resolves with the secret needed to finish the export.
function waitForAuthorization(popup: Window, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      window.clearTimeout(timeout);
    }
    function settle(action: () => void) {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    }

    function onMessage(event: MessageEvent) {
      // Only listen to the GitHub window we opened, and only if it came from our own backend
      if (event.source !== popup || event.origin !== BACKEND_ORIGIN) return;
      const data = event.data as
        | { type?: string; state?: string; finishSecret?: string; message?: string }
        | null;
      if (!data || data.state !== state) return;

      if (data.type === "github-authorized" && typeof data.finishSecret === "string") {
        const secret = data.finishSecret;
        settle(() => resolve(secret));
      } else if (data.type === "github-export-error") {
        settle(() => reject(new Error(data.message || "GitHub authorization failed.")));
      }
    }

    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        // Give a message that is still on its way a moment to arrive
        window.setTimeout(
          () => settle(() => reject(new Error("The GitHub window was closed before the export finished."))),
          400
        );
      }
    }, 500);
    const timeout = window.setTimeout(
      () => settle(() => reject(new Error("Timed out waiting for GitHub."))),
      WAIT_LIMIT_MS
    );

    window.addEventListener("message", onMessage);
  });
}

// Call this straight from a click handler. Browsers only allow the popup if it opens right away.
export async function exportToGitHub(
  slug: string,
  request: GithubExportRequest
): Promise<GithubExportResult> {
  const popup = window.open("", "github-export", "width=620,height=760");
  if (!popup) {
    throw new Error("The browser blocked the GitHub window. Allow popups for this site and try again.");
  }

  try {
    const { authorize_url, state } = await startGithubExport(slug, request);
    popup.location.href = authorize_url;
    const finishSecret = await waitForAuthorization(popup, state);
    return await finishGithubExport(slug, { state, finish_secret: finishSecret });
  } finally {
    if (!popup.closed) popup.close();
  }
}