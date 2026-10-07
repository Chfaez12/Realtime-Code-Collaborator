import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { exportToGitHub } from "../../lib/githubExport";
import type { GithubExportRequest, GithubExportResult } from "../../lib/sessionsApi";

interface ExportGitHubModalProps {
  sessionId: string;
  defaultFilename: string;
  onClose: () => void;
}

type Kind = "gist" | "repo";
type Status = "idle" | "working" | "done";

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FILE_PATH = /^[\w.-]+(\/[\w.-]+)*$/;

const label: CSSProperties = { fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" };
const field: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: "13px",
  background: "#2a2a2a", color: "#fff", border: "1px solid #444", borderRadius: "4px",
};

export default function ExportGitHubModal({ sessionId, defaultFilename, onClose }: ExportGitHubModalProps) {
  const [kind, setKind] = useState<Kind>("gist");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GithubExportResult | null>(null);

  // Gist
  const [filename, setFilename] = useState(defaultFilename);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Repository
  const [repository, setRepository] = useState("");
  const [path, setPath] = useState(defaultFilename);
  const [branch, setBranch] = useState("");
  const [message, setMessage] = useState("Export from Realtime Code Collaborator");
  const [includePrivate, setIncludePrivate] = useState(false);

  const working = status === "working";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !working && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, working]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (working) return;
    setError(null);

    let request: GithubExportRequest;
    if (kind === "gist") {
      if (!filename.trim()) {
        setError("Enter a file name.");
        return;
      }
      request = { kind: "gist", filename: filename.trim(), description: description.trim(), public: isPublic };
    } else {
      const repo = repository.trim();
      const cleanPath = path.trim().replace(/^\/+/, "");
      if (!REPOSITORY.test(repo)) {
        setError("Enter the repository as owner/name, for example my-account/my-project.");
        return;
      }
      if (!FILE_PATH.test(cleanPath)) {
        setError("Enter a file path such as src/main.py.");
        return;
      }
      request = {
        kind: "repo",
        repository: repo,
        path: cleanPath,
        branch: branch.trim() || undefined,
        message: message.trim() || "Export from Realtime Code Collaborator",
        include_private: includePrivate,
      };
    }

    setStatus("working");
    // Started directly from the click, so the browser allows the GitHub window to open
    exportToGitHub(sessionId, request)
      .then((exported) => {
        setResult(exported);
        setStatus("done");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "The export failed.");
        setStatus("idle");
      });
  };

  return (
    <div
      onClick={() => !working && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export to GitHub"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(460px, 92vw)", maxHeight: "90vh", overflowY: "auto", background: "#1e1e1e",
          color: "#fff", textAlign: "left", border: "1px solid #444", borderRadius: "8px",
          padding: "20px", display: "flex", flexDirection: "column", gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Export to GitHub</h2>
          <button
            onClick={onClose}
            disabled={working}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "18px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {status === "done" && result ? (
          <>
            <div style={{ fontSize: "14px", color: "#4ade80" }}>
              {result.kind === "gist" ? "Gist created." : "File committed."}
            </div>
            <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: "14px", wordBreak: "break-all" }}>
              {result.url}
            </a>
            {result.commit_url && (
              <a href={result.commit_url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: "13px", wordBreak: "break-all" }}>
                View the commit
              </a>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "6px 14px", fontSize: "13px", background: "#2563eb", color: "#fff",
                  border: "none", borderRadius: "4px", cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["gist", "repo"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={working}
                  onClick={() => setKind(option)}
                  style={{
                    flex: 1, padding: "6px", fontSize: "13px", borderRadius: "4px", cursor: "pointer",
                    background: kind === option ? "#1e3a8a" : "transparent",
                    border: `1px solid ${kind === option ? "#60a5fa" : "#444"}`,
                    color: kind === option ? "#bfdbfe" : "#aaa",
                  }}
                >
                  {option === "gist" ? "Gist" : "Repository file"}
                </button>
              ))}
            </div>

            {kind === "gist" ? (
              <>
                <div>
                  <label htmlFor="gh-filename" style={label}>File name</label>
                  <input id="gh-filename" value={filename} maxLength={100} onChange={(e) => setFilename(e.target.value)} style={field} />
                </div>
                <div>
                  <label htmlFor="gh-description" style={label}>Description (optional)</label>
                  <input id="gh-description" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} style={field} />
                </div>
                <label style={{ ...label, cursor: "pointer" }}>
                  <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} style={{ marginRight: "6px" }} />
                  Make it public (otherwise it is a secret gist: unlisted, but anyone with the link can read it)
                </label>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="gh-repo" style={label}>Repository (owner/name)</label>
                  <input id="gh-repo" value={repository} maxLength={201} placeholder="my-account/my-project" onChange={(e) => setRepository(e.target.value)} style={field} />
                </div>
                <div>
                  <label htmlFor="gh-path" style={label}>File path in the repository</label>
                  <input id="gh-path" value={path} maxLength={200} onChange={(e) => setPath(e.target.value)} style={field} />
                </div>
                <div>
                  <label htmlFor="gh-branch" style={label}>Branch (optional, defaults to the repository's default)</label>
                  <input id="gh-branch" value={branch} maxLength={100} onChange={(e) => setBranch(e.target.value)} style={field} />
                </div>
                <div>
                  <label htmlFor="gh-message" style={label}>Commit message</label>
                  <input id="gh-message" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} style={field} />
                </div>
                <label style={{ ...label, cursor: "pointer" }}>
                  <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} style={{ marginRight: "6px" }} />
                  This is a private repository (asks GitHub for broader access)
                </label>
                <div style={{ fontSize: "12px", color: "#888" }}>
                  If the file already exists, it is updated with a new commit.
                </div>
              </>
            )}

            {error && (
              <div role="alert" style={{ fontSize: "13px", color: "#f87171" }}>
                {error}
              </div>
            )}

            <div style={{ fontSize: "12px", color: "#888" }}>
              A GitHub window opens so you can approve this once. Nothing is stored, and the
              permission is cancelled right after the export.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={onClose}
                disabled={working}
                style={{
                  padding: "6px 14px", fontSize: "13px", background: "transparent", color: "#ccc",
                  border: "1px solid #555", borderRadius: "4px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={working}
                style={{
                  padding: "6px 14px", fontSize: "13px", background: "#2563eb", color: "#fff",
                  border: "none", borderRadius: "4px", cursor: working ? "not-allowed" : "pointer",
                  opacity: working ? 0.6 : 1,
                }}
              >
                {working ? "Waiting for GitHub..." : "Continue with GitHub"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}