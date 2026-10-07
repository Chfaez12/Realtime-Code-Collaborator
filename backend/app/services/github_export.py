import base64
import hmac
import logging
import secrets
import time
import uuid
from dataclasses import dataclass, field
from urllib.parse import quote, urlencode

import httpx
from fastapi import HTTPException

from app.config import settings
from app.schemas.github import ExportResult, GistExport, RepoExport

log = logging.getLogger("uvicorn.error")

GITHUB_API = "https://api.github.com"
PENDING_TTL_SECONDS = 600     # time to complete the screen on GitHub
AUTHORIZED_TTL_SECONDS = 120  # time between GitHub's approval and the editor finishing the export
MAX_PENDING = 200


class ExportError(Exception):
    """A problem whose message is safe to show to the user."""


@dataclass
class PendingExport:
    session_id: uuid.UUID
    request: GistExport | RepoExport
    content: str
    scope: str
    created_at: float = field(default_factory=time.monotonic)
    authorized_at: float | None = None
    token: str | None = None
    finish_secret: str | None = None


# In memory and short-lived. The token only exists here, between GitHub's approval and the export.
_pending: dict[str, PendingExport] = {}


def is_configured() -> bool:
    return bool(settings.github_client_id and settings.github_client_secret)


def callback_url() -> str:
    return f"{settings.public_backend_url.rstrip('/')}/github/callback"


def scope_for(request: GistExport | RepoExport) -> str:
    if isinstance(request, GistExport):
        return "gist"
    return "repo" if request.include_private else "public_repo"


def _expired(job: PendingExport, now: float) -> bool:
    if job.authorized_at is not None:
        return now - job.authorized_at > AUTHORIZED_TTL_SECONDS
    return now - job.created_at > PENDING_TTL_SECONDS


def _purge() -> None:
    now = time.monotonic()
    for key in [key for key, job in _pending.items() if _expired(job, now)]:
        del _pending[key]


def create_pending(session_id: uuid.UUID, request: GistExport | RepoExport, content: str) -> str:
    _purge()
    if len(_pending) >= MAX_PENDING:
        raise HTTPException(status_code=503, detail="Too many exports are in progress. Try again in a minute.")
    state = secrets.token_urlsafe(32)
    _pending[state] = PendingExport(
        session_id=session_id, request=request, content=content, scope=scope_for(request)
    )
    return state


def authorize_url(state: str, scope: str) -> str:
    query = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": callback_url(),
            "scope": scope,
            "state": state,
        }
    )
    return f"https://github.com/login/oauth/authorize?{query}"


def discard(state: str) -> None:
    _pending.pop(state, None)


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "realtime-code-collaborator",
    }


def _explain(response: httpx.Response) -> str:
    try:
        detail = str(response.json().get("message", ""))
    except ValueError:
        detail = ""

    status = response.status_code
    if status == 401:
        return "GitHub rejected the authorization. Please try again."
    if status == 403:
        return (
            "GitHub refused this. The repository's organization may restrict third-party apps, "
            "or you don't have write access. " + detail
        ).strip()
    if status == 404:
        return "The repository, branch or path wasn't found, or you don't have write access to it."
    if status == 409:
        return "The file changed on GitHub while exporting. Please try again."
    if status == 422:
        return f"GitHub couldn't accept this: {detail or 'invalid request'}"
    return f"GitHub returned an error ({status}). {detail}".strip()


async def _exchange_code(code: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json", "User-Agent": "realtime-code-collaborator"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": callback_url(),
                },
            )
        data = response.json()
    except (httpx.HTTPError, ValueError):
        raise ExportError("Could not reach GitHub. Please try again.")

    token = data.get("access_token")
    if not isinstance(token, str) or not token:
        raise ExportError(str(data.get("error_description") or "GitHub did not approve the request."))
    return token


async def complete_authorization(state: str, code: str) -> str:
    """Called when GitHub sends the browser back. Exchanges the code for a token, keeps it in
    memory, and returns the secret that only the originating editor window will receive."""
    _purge()
    job = _pending.get(state)
    if job is None or job.authorized_at is not None:
        raise ExportError("This export request expired or was already used. Start it again from the editor.")

    try:
        token = await _exchange_code(code)
    except ExportError:
        _pending.pop(state, None)
        raise

    job.token = token
    job.finish_secret = secrets.token_urlsafe(32)
    job.authorized_at = time.monotonic()
    return job.finish_secret


def take_authorized(state: str, finish_secret: str, session_id: uuid.UUID) -> PendingExport | None:
    """Hands over an authorized job exactly once, only to the caller that holds both
    the state and the secret, and only for the session it was started for."""
    _purge()
    job = _pending.get(state)
    if job is None or job.token is None or job.finish_secret is None or job.session_id != session_id:
        return None
    if not hmac.compare_digest(job.finish_secret, finish_secret):
        return None
    del _pending[state]
    return job


async def _create_gist(client: httpx.AsyncClient, token: str, request: GistExport, content: str) -> ExportResult:
    response = await client.post(
        f"{GITHUB_API}/gists",
        headers=_headers(token),
        json={
            "description": request.description,
            "public": request.public,
            "files": {request.filename: {"content": content}},
        },
    )
    if response.status_code != 201:
        raise ExportError(_explain(response))
    return ExportResult(kind="gist", url=response.json()["html_url"])


async def _commit_file(client: httpx.AsyncClient, token: str, request: RepoExport, content: str) -> ExportResult:
    url = f"{GITHUB_API}/repos/{request.repository}/contents/{quote(request.path, safe='/')}"

    # If the file already exists, GitHub needs its current version to replace it
    existing = await client.get(
        url, headers=_headers(token), params={"ref": request.branch} if request.branch else None
    )
    body: dict[str, str] = {
        "message": request.message,
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
    }
    if request.branch:
        body["branch"] = request.branch

    if existing.status_code == 200:
        data = existing.json()
        if not isinstance(data, dict) or not data.get("sha"):
            raise ExportError("That path is a folder. Choose a file path such as src/main.py.")
        body["sha"] = data["sha"]
    elif existing.status_code != 404:
        raise ExportError(_explain(existing))

    response = await client.put(url, headers=_headers(token), json=body)
    if response.status_code not in (200, 201):
        raise ExportError(_explain(response))

    data = response.json()
    return ExportResult(
        kind="repo",
        url=data["content"]["html_url"],
        commit_url=data["commit"]["html_url"],
    )


async def run_export(job: PendingExport) -> ExportResult:
    assert job.token is not None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if isinstance(job.request, GistExport):
                return await _create_gist(client, job.token, job.request, job.content)
            return await _commit_file(client, job.token, job.request, job.content)
    except httpx.HTTPError:
        raise ExportError("Could not reach GitHub. Please try again.")
    except (KeyError, ValueError):
        raise ExportError("GitHub answered in an unexpected way. Please try again.")


async def revoke_token(token: str | None) -> None:
    """Invalidates the one-time token right after use. The grant stays, so next time GitHub
    approves instantly, but this token can never be used again."""
    if not token:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.request(
                "DELETE",
                f"{GITHUB_API}/applications/{settings.github_client_id}/token",
                auth=(settings.github_client_id, settings.github_client_secret),
                headers={
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "realtime-code-collaborator",
                },
                json={"access_token": token},
            )
    except httpx.HTTPError:
        log.warning("Could not revoke a GitHub export token. It will expire from memory on its own.")