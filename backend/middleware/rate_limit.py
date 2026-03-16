import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException


class RateLimiter:
    """Simple in-process sliding-window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            timestamps = self._requests[key]
            # Evict entries outside the window
            self._requests[key] = [t for t in timestamps if now - t < self.window]
            if len(self._requests[key]) >= self.max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Rate limit exceeded: max {self.max_requests} requests "
                        f"per {self.window}s."
                    ),
                )
            self._requests[key].append(now)


# Shared limiters — adjust thresholds as needed
ws_text_limiter = RateLimiter(max_requests=60, window_seconds=60)   # 60 questions/min per session+witness
ws_voice_limiter = RateLimiter(max_requests=20, window_seconds=60)  # 20 voice turns/min
session_create_limiter = RateLimiter(max_requests=10, window_seconds=60)  # 10 sessions/min per IP
