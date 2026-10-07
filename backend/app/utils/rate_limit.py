import time
from collections import deque


class FailureLimiter:
    """Blocks a key after too many recent failures. In memory, per process."""

    def __init__(self, max_failures: int, window_seconds: float):
        self.max_failures = max_failures
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = {}

    def _prune(self, key: str) -> deque[float] | None:
        q = self._failures.get(key)
        if q is None:
            return None
        cutoff = time.monotonic() - self.window
        while q and q[0] < cutoff:
            q.popleft()
        if not q:
            del self._failures[key]
            return None
        return q

    def blocked(self, key: str) -> bool:
        q = self._prune(key)
        return q is not None and len(q) >= self.max_failures

    def record_failure(self, key: str) -> None:
        self._failures.setdefault(key, deque()).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


class RequestLimiter:
    """Allows at most `max_requests` per `window_seconds` for each key. In memory, per process."""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        cutoff = now - self.window
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return False
        hits.append(now)
        return True