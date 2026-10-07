import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Literal
from contextlib import asynccontextmanager

import httpx
from fastapi import HTTPException

from app.config import settings

log = logging.getLogger("uvicorn.error")


LANGUAGES: dict[str, tuple[str, str]] = {
    "javascript": ("javascript", "main.js"),
    "typescript": ("typescript", "main.ts"),
    "python": ("python", "main.py"),
    "java": ("java", "Main.java"),
    "c": ("c", "main.c"),
    "cpp": ("c++", "main.cpp"),
    "go": ("go", "main.go"),
    "rust": ("rust", "main.rs"),
    "php": ("php", "main.php"),
    "ruby": ("ruby", "main.rb"),
}

MAX_CONCURRENT_RUNS = 4  # protects Piston from being flooded
REQUEST_TIMEOUT_SECONDS = 30
_slots = asyncio.Semaphore(MAX_CONCURRENT_RUNS)

_JAVA_PUBLIC_CLASS = re.compile(r"public\s+(?:final\s+|abstract\s+)*class\s+(\w+)")


@dataclass
class RunResult:
    stdout: str
    stderr: str
    exit_code: int | None
    phase: Literal["compile", "run"]
    duration_ms: int


def _filename_for(language_id: str, code: str) -> str:
    _, filename = LANGUAGES[language_id]
    if language_id == "java":
        
        match = _JAVA_PUBLIC_CLASS.search(code)
        if match:
            return f"{match.group(1)}.java"
    return filename


async def execute(language_id: str, code: str, stdin: str) -> RunResult:
    piston_language, _ = LANGUAGES[language_id]
    log.info("Piston stdin: %r", stdin)
    payload = {
        "language": piston_language,
        "version": "*",  
        "files": [{"name": _filename_for(language_id, code), "content": code}],
        "stdin": stdin,
        "run_timeout": 10000,
    }

    started = time.monotonic()
    try:
        async with _slots:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(f"{settings.piston_url.rstrip('/')}/execute", json=payload)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=503,
            detail="The code execution service isn't reachable. Is Piston running?",
        )
    duration_ms = round((time.monotonic() - started) * 1000)

    if response.status_code == 400:
        
        try:
            reason = response.json().get("message", "")
        except ValueError:
            reason = ""
        raise HTTPException(
            status_code=422,
            detail=f"{piston_language} isn't available on the execution server. {reason}".strip(),
        )
    if response.status_code != 200:
        log.error("Piston returned %s: %s", response.status_code, response.text[:300])
        raise HTTPException(status_code=502, detail="The code execution service returned an error")

    data = response.json()
    log.info("Piston response: %s", data)
    compile_stage = data.get("compile")
    if compile_stage and compile_stage.get("code") != 0:
        return RunResult(
            stdout=compile_stage.get("stdout") or "",
            stderr=compile_stage.get("stderr") or compile_stage.get("output") or "Compilation failed",
            exit_code=compile_stage.get("code"),
            phase="compile",
            duration_ms=duration_ms,
        )

    run = data.get("run") or {}
    stderr = run.get("stderr") or ""
    if run.get("signal") and not stderr:
        stderr = (
            f"The program was stopped ({run['signal']}). "
            "It most likely ran too long or used too much memory.\n"
        )

    return RunResult(
        stdout=run.get("stdout") or "",
        stderr=stderr,
        exit_code=run.get("code"),
        phase="run",
        duration_ms=duration_ms,
    )

class ExecutionBusy(Exception):
    """All execution slots are in use."""


@asynccontextmanager
async def run_slot(wait_seconds: float = 2.0):
    """Holds one of the limited execution slots for the duration of a run."""
    try:
        await asyncio.wait_for(_slots.acquire(), timeout=wait_seconds)
    except asyncio.TimeoutError:
        raise ExecutionBusy()
    try:
        yield
    finally:
        _slots.release()


def filename_for(language_id: str, code: str) -> str:
    return _filename_for(language_id, code)


def piston_ws_url() -> str:
    """Piston's interactive endpoint: ws://<host>/api/v2/connect"""
    base = settings.piston_url.rstrip("/")
    base = base.replace("http://", "ws://", 1).replace("https://", "wss://", 1)
    return f"{base}/connect"


# Makes a paused stdin stop keeping Node alive, the way a terminal behaves.
# Piston keeps the input pipe open, so without this, programs that use readline never finish.
# It sits on the first line, so line numbers in the user's code don't change.
_JS_STDIN_PRELUDE = (
    '(function(){try{var s=process.stdin;if(typeof s.unref!=="function"||typeof s.ref!=="function")return;'
    'var p=s.pause,r=s.resume;'
    's.pause=function(){var x=p.apply(this,arguments);try{this.unref()}catch(e){}return x};'
    's.resume=function(){try{this.ref()}catch(e){}return r.apply(this,arguments)}}catch(e){}})();'
)
_TS_STDIN_PRELUDE = _JS_STDIN_PRELUDE.replace("process.stdin", "(globalThis as any).process.stdin")

# Without this, Piston's TypeScript compiler doesn't know about Promise, async/await, Map or Set
_TS_LIB_DIRECTIVE = '/// <reference lib="es2018" />'

_TS_LOCATION = re.compile(r"main(?:\.ts)*\((\d+),(\d+)\)")


def prepare_source(language_id: str, code: str) -> str:
    """Small invisible adjustments so programs behave in the sandbox like they do in a terminal."""
    stripped = code.lstrip()
    # A shebang or a "use strict" directive has to stay the very first thing in the file
    if stripped.startswith(("#!", '"use strict"', "'use strict'")):
        return code
    if language_id == "javascript":
        return f"{_JS_STDIN_PRELUDE} {code}"
    if language_id == "typescript":
        return f"{_TS_LIB_DIRECTIVE}\n{_TS_STDIN_PRELUDE} {code}"
    return code


def adjust_compile_text(language_id: str, text: str) -> str:
    """TypeScript gets one extra line on top, so shift its error locations back to match."""
    if language_id != "typescript":
        return text
    return _TS_LOCATION.sub(lambda m: f"main.ts({max(int(m.group(1)) - 1, 1)},{m.group(2)})", text)