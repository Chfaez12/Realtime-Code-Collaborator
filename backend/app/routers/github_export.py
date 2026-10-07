import html
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from app.config import settings
from app.models import CodingSession
from app.routers.sessions import get_owned_session
from app.schemas.github import ExportRequest, ExportResult, FinishRequest, StartResponse
from app.services import github_export
from app.sync import persistence
from app.services import snapshot_service
from app.utils.rate_limit import RequestLimiter

router = APIRouter(tags=["github"])

# 10 exports per hour per client and session
start_limiter = RequestLimiter(max_requests=10, window_seconds=3600)


@router.post("/sessions/{slug}/export/github/start", response_model=StartResponse)
async def start_export(
    payload: ExportRequest,
    request: Request,
    session: CodingSession = Depends(get_owned_session),  # owner only
):
    if not github_export.is_configured():
        raise HTTPException(status_code=503, detail="GitHub export isn't configured on the server.")

    client_ip = request.client.host if request.client else "unknown"
    if not start_limiter.allow(f"{client_ip}:{session.slug}"):
        raise HTTPException(status_code=429, detail="Too many exports. Try again later.")

    # The code comes from the server's copy of the document, never from the browser
    state_bytes = await snapshot_service.current_state(session.slug, session.id)
    content = persistence.text_of_state(state_bytes)
    if not content.strip():
        raise HTTPException(status_code=400, detail="There is no code to export yet.")

    state = github_export.create_pending(session.id, payload, content)
    return StartResponse(
        authorize_url=github_export.authorize_url(state, github_export.scope_for(payload)),
        state=state,
    )


@router.post("/sessions/{slug}/export/github/finish", response_model=ExportResult)
async def finish_export(
    payload: FinishRequest,
    session: CodingSession = Depends(get_owned_session),
):
    job = github_export.take_authorized(payload.state, payload.finish_secret, session.id)
    if job is None:
        raise HTTPException(
            status_code=400,
            detail="The GitHub approval expired or was already used. Start the export again.",
        )
    try:
        return await github_export.run_export(job)
    except github_export.ExportError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        await github_export.revoke_token(job.token)


def _page(title: str, message: str, payload: dict | None) -> HTMLResponse:
    """The small page GitHub sends the popup back to. It hands the result to the editor window."""
    script = ""
    if payload is not None:
        data = json.dumps(payload).replace("<", "\\u003c")
        origin = json.dumps(settings.frontend_origin).replace("<", "\\u003c")
        script = f"""<script>
(function () {{
  var payload = {data};
  var opener = window.opener;
  if (opener) {{
    try {{ opener.postMessage(payload, {origin}); }} catch (e) {{}}
    setTimeout(function () {{ window.close(); }}, 150);
  }} else {{
    document.getElementById("note").style.display = "block";
  }}
}})();
</script>"""

    body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {{ font-family: system-ui, sans-serif; background: #1e1e1e; color: #fff; display: flex;
         align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }}
  main {{ max-width: 420px; padding: 24px; }}
  p {{ color: #aaa; }}
  #note {{ display: none; color: #fbbf24; }}
</style></head>
<body><main>
  <h1>{html.escape(title)}</h1>
  <p>{html.escape(message)}</p>
  <p id="note">This window could not reach the editor. Close it and try the export again.</p>
</main>{script}</body></html>"""

    return HTMLResponse(
        body,
        headers={
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; "
            "script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
        },
    )


@router.get("/github/callback", response_class=HTMLResponse)
async def github_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    if not state or len(state) > 200:
        return _page("Something went wrong", "This link isn't valid. Start the export again from the editor.", None)

    if error or not code:
        github_export.discard(state)
        message = (
            "Authorization was cancelled."
            if error == "access_denied"
            else (error_description or error or "GitHub did not return a code.")
        )
        return _page("Not connected", message, {"type": "github-export-error", "state": state, "message": message})

    try:
        finish_secret = await github_export.complete_authorization(state, code)
    except github_export.ExportError as exc:
        return _page("Not connected", str(exc), {"type": "github-export-error", "state": state, "message": str(exc)})

    return _page(
        "Connected to GitHub",
        "Finishing the export. You can close this window.",
        {"type": "github-authorized", "state": state, "finishSecret": finish_secret},
    )