import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from websockets.exceptions import WebSocketException

from app.auth.access import check_access
from app.config import settings
from app.database import SessionLocal
from app.models import CodingSession
from app.routers.execute import run_limiter
from app.services import piston_client

log = logging.getLogger("uvicorn.error")
router = APIRouter()

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{6,32}$")

MAX_CODE_CHARS = 100_000
MAX_RUN_SECONDS = 60
MAX_OUTPUT_CHARS = 200_000
MAX_STDIN_MESSAGE_CHARS = 4_096
MAX_STDIN_TOTAL_CHARS = 20_000
START_TIMEOUT_SECONDS = 10

# Custom close codes (4000-4999 are reserved for applications)
CLOSE_BAD_REQUEST = 4400
CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_NOT_FOUND = 4404
CLOSE_EXPIRED = 4410
CLOSE_TOO_MANY = 4429
CLOSE_BUSY = 4503


async def _send(ws: WebSocket, payload: dict) -> bool:
    try:
        await ws.send_text(json.dumps(payload))
        return True
    except Exception:
        return False


async def _close(ws: WebSocket, code: int = 1000) -> None:
    try:
        await ws.close(code=code)
    except Exception:
        pass  


async def _refuse(ws: WebSocket, message: str, code: int) -> None:
    await _send(ws, {"type": "error", "message": message})
    await _close(ws, code)


async def _find_session(slug: str) -> CodingSession | None:
    async with SessionLocal() as db:
        result = await db.execute(select(CodingSession).where(CodingSession.slug == slug))
        return result.scalar_one_or_none()


async def _bridge(browser: WebSocket, language_id: str, code: str) -> None:
    """Connects the browser to a Piston interactive run and relays messages both ways."""
    piston_language, _ = piston_client.LANGUAGES[language_id]
    init = {
        "type": "init",
        "language": piston_language,
        "version": "*",
        "files": [
            {
                "name": piston_client.filename_for(language_id, code),
                "content": piston_client.prepare_source(language_id, code),
            }
        ],
    }
    started = time.monotonic()
    finished = False

    try:
        async with websockets.connect(
            piston_client.piston_ws_url(), open_timeout=5, max_size=2**20
        ) as piston:
            await piston.send(json.dumps(init))  # Piston requires this within one second

            async def piston_to_browser() -> None:
                nonlocal finished
                output_chars = 0
                current_stage = None
                async for raw in piston:
                    message = json.loads(raw)
                    kind = message.get("type")

                    if kind == "stage":
                        current_stage = message.get("stage")
                        if not await _send(browser, {"type": "stage", "stage": current_stage}):
                            return
                    elif kind == "data":
                        stream = message.get("stream")
                        data = message.get("data") or ""
                        if stream not in ("stdout", "stderr"):
                            continue
                        if current_stage == "compile":
                            data = piston_client.adjust_compile_text(language_id, data)
                        output_chars += len(data)
                        
                        if stream not in ("stdout", "stderr"):
                            continue
                        output_chars += len(data)
                        if output_chars > MAX_OUTPUT_CHARS:
                            await _send(browser, {"type": "error", "message": "Output limit exceeded. The program was stopped."})
                            return
                        if not await _send(browser, {"type": "data", "stream": stream, "data": data}):
                            return
                    elif kind == "exit":
                        stage = message.get("stage")
                        exit_code = message.get("code")
                        signal = message.get("signal")
                        await _send(
                            browser,
                            {
                                "type": "exit",
                                "stage": stage,
                                "code": exit_code,
                                "signal": signal,
                                "duration_ms": round((time.monotonic() - started) * 1000),
                            },
                        )
                        # A finished run, or a compile step that failed, ends the job
                        if stage == "run" or exit_code != 0 or signal:
                            finished = True
                            return
                    elif kind == "error":
                        await _send(browser, {"type": "error", "message": message.get("message") or "Execution error"})
                        finished = True
                        return

            async def browser_to_piston() -> None:
                stdin_total = 0
                while True:
                    raw = await browser.receive_text()  # raises WebSocketDisconnect if the browser leaves
                    try:
                        message = json.loads(raw)
                    except ValueError:
                        continue

                    if message.get("type") == "stdin":
                        data = message.get("data")
                        if not isinstance(data, str):
                            continue
                        data = data[:MAX_STDIN_MESSAGE_CHARS]
                        stdin_total += len(data)
                        if stdin_total > MAX_STDIN_TOTAL_CHARS:
                            continue
                        await piston.send(json.dumps({"type": "data", "stream": "stdin", "data": data}))
                    elif message.get("type") == "kill":
                        await piston.send(json.dumps({"type": "signal", "signal": "SIGKILL"}))

            to_browser = asyncio.create_task(piston_to_browser())
            from_browser = asyncio.create_task(browser_to_piston())
            try:
                async with asyncio.timeout(MAX_RUN_SECONDS):
                    done, _ = await asyncio.wait(
                        {to_browser, from_browser}, return_when=asyncio.FIRST_COMPLETED
                    )
                for task in done:
                    task.result()  # re-raises a failure from either direction
            finally:
                for task in (to_browser, from_browser):
                    task.cancel()
                await asyncio.gather(to_browser, from_browser, return_exceptions=True)
                if not finished:
                    # The browser left, or we timed out: make sure the program doesn't keep running
                    try:
                        await piston.send(json.dumps({"type": "signal", "signal": "SIGKILL"}))
                    except Exception:
                        pass

    except TimeoutError:
        await _send(browser, {"type": "error", "message": f"The program was stopped after {MAX_RUN_SECONDS} seconds."})
    except (OSError, WebSocketException):
        if not finished:
            await _send(
                browser,
                {"type": "error", "message": "The code execution service isn't reachable. Is Piston running?"},
            )


@router.websocket("/ws/run/{slug}")
async def run_endpoint(websocket: WebSocket, slug: str):
    # Same cross-site protection as the sync socket
    origin = websocket.headers.get("origin")
    if origin is not None and origin != settings.frontend_origin:
        await _close(websocket, CLOSE_FORBIDDEN)
        return

    await websocket.accept()

    if not SLUG_RE.match(slug):
        await _refuse(websocket, "Invalid session id", CLOSE_BAD_REQUEST)
        return

    # The first message carries the code and the credentials
    try:
        start = json.loads(await asyncio.wait_for(websocket.receive_text(), timeout=START_TIMEOUT_SECONDS))
    except WebSocketDisconnect:
        return
    except Exception:
        await _refuse(websocket, "Expected a start message", CLOSE_BAD_REQUEST)
        return

    language_id = start.get("language") if isinstance(start, dict) else None
    code = start.get("code") if isinstance(start, dict) else None
    if (
        not isinstance(start, dict)
        or start.get("type") != "start"
        or language_id not in piston_client.LANGUAGES
        or not isinstance(code, str)
        or len(code) > MAX_CODE_CHARS
    ):
        await _refuse(websocket, "Invalid run request", CLOSE_BAD_REQUEST)
        return

    session = await _find_session(slug)
    if session is None:
        await _refuse(websocket, "Session not found", CLOSE_NOT_FOUND)
        return
    if session.expires_at and session.expires_at < datetime.now(timezone.utc):
        await _refuse(websocket, "Session has expired", CLOSE_EXPIRED)
        return

    client_ip = websocket.client.host if websocket.client else "unknown"
    key = f"{client_ip}:{slug}"

    owner_token = start.get("owner_token") if isinstance(start.get("owner_token"), str) else None
    password = start.get("password") if isinstance(start.get("password"), str) else None
    problem = await check_access(session, owner_token, password, key)
    if problem:
        await _refuse(websocket, problem, CLOSE_UNAUTHORIZED)
        return

    if not run_limiter.allow(key):
        await _refuse(websocket, "You're running code too fast. Wait a moment and try again.", CLOSE_TOO_MANY)
        return

    try:
        async with piston_client.run_slot():
            await _bridge(websocket, language_id, code)
    except piston_client.ExecutionBusy:
        await _refuse(websocket, "The execution server is busy. Try again in a moment.", CLOSE_BUSY)
        return
    except WebSocketDisconnect:
        return  # the browser left mid-run; _bridge already stopped the program

    await _close(websocket)