import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.config import settings

log = logging.getLogger("uvicorn.error")


class AIUnavailable(Exception):
    """A problem with the AI service whose message is safe to show to the user."""


def is_available() -> bool:
    return settings.ai_enabled and bool(settings.ai_api_key) and bool(settings.ai_base_url)


_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if not is_available():
        raise AIUnavailable("AI features aren't enabled on this server.")
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    return _client


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ai_api_key}", "Content-Type": "application/json"}


def _url() -> str:
    return f"{settings.ai_base_url}/chat/completions"


def _payload(model: str, system: str, messages: list[dict], max_tokens: int, stream: bool) -> dict:
    body: dict = {
        "model": model,
        "messages": [{"role": "system", "content": system}, *messages],
        "max_tokens": max_tokens + max(0, settings.ai_token_headroom),
        "stream": stream,
    }
    if settings.ai_reasoning_effort:
        body["reasoning_effort"] = settings.ai_reasoning_effort
    return body


def _explain_status(response: httpx.Response) -> AIUnavailable:
    """Turns a provider error into a message that is safe to show. Details go to the server log."""
    status = response.status_code
    detail = ""
    try:
        body = response.json()
        if isinstance(body, list) and body:  # Gemini sometimes wraps its errors in a list
            body = body[0]
        error = body.get("error") if isinstance(body, dict) else None
        detail = str(error.get("message") if isinstance(error, dict) else (error or ""))[:300]
    except ValueError:
        detail = response.text[:300]

    if status in (401, 403):
        log.error("The AI provider rejected the API key (%s): %s", status, detail)
        return AIUnavailable("The AI service isn't set up correctly on the server.")
    if status == 404:
        log.error("The AI provider doesn't know that model or address: %s", detail)
        return AIUnavailable("The configured AI model isn't available. Check the model names in the server settings.")
    if status == 429:
        log.warning("The AI provider's free limit was reached: %s", detail)
        return AIUnavailable("The AI service's free limit was reached. Try again in a minute.")
    if status in (400, 422):
        log.error("The AI provider rejected a request (%s): %s", status, detail)
        return AIUnavailable("The AI service rejected this request.")
    log.error("The AI provider returned an error (%s): %s", status, detail)
    return AIUnavailable("The AI service had a problem. Please try again.")


async def stream_chat(*, model: str, system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
    client = _get_client()
    try:
        async with client.stream(
            "POST", _url(), headers=_headers(), json=_payload(model, system, messages, max_tokens, True)
        ) as response:
            if response.status_code != 200:
                await response.aread()
                raise _explain_status(response)

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except ValueError:
                    continue
                for choice in chunk.get("choices") or []:
                    text = (choice.get("delta") or {}).get("content")
                    if text:
                        yield text
    except httpx.HTTPError as exc:
        log.error("Could not reach the AI provider: %r", exc)
        raise AIUnavailable("Could not reach the AI service.")


async def complete(*, model: str, system: str, messages: list[dict], max_tokens: int) -> str:
    client = _get_client()
    try:
        response = await client.post(
            _url(), headers=_headers(), json=_payload(model, system, messages, max_tokens, False)
        )
    except httpx.HTTPError as exc:
        log.error("Could not reach the AI provider: %r", exc)
        raise AIUnavailable("Could not reach the AI service.")

    if response.status_code != 200:
        raise _explain_status(response)

    try:
        content = response.json()["choices"][0]["message"].get("content")
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        raise AIUnavailable("The AI service answered in an unexpected way.")
    return content if isinstance(content, str) else ""