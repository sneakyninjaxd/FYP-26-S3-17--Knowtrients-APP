"""
Request timing and error counting, for the Platform Administrator's
performance figures.

Middleware records each request's duration and whether it failed with a
server error. Counts accumulate in memory and are added to the
`request_stats` table periodically, and whenever the analytics endpoint is
read, so the figures shown are current.

What this measures and what it doesn't
--------------------------------------
It measures requests that reached this server: how long they took and how
many failed with a 5xx error. It cannot measure downtime — a server that is
down records nothing — so the website shows a request success rate rather
than claiming an uptime percentage. Requests lost while the service is
restarting, or while the free hosting tier wakes from sleep, aren't counted.
"""

import asyncio
import time
from collections import defaultdict
from datetime import date

from sqlalchemy import text

from .database import SessionLocal

# Paths excluded from the figures. Documentation pages aren't app traffic,
# and uptime checks hitting /health would swamp the averages.
_EXCLUDED_PREFIXES = ("/docs", "/redoc", "/openapi.json", "/health", "/favicon")

# day -> [requests, errors, total_ms]
_pending: dict[date, list] = defaultdict(lambda: [0, 0, 0.0])

FLUSH_INTERVAL_SECONDS = 60


def record(path: str, status_code: int, elapsed_ms: float) -> None:
    """Counts one request."""
    if path.startswith(_EXCLUDED_PREFIXES):
        return
    bucket = _pending[date.today()]
    bucket[0] += 1
    if status_code >= 500:
        bucket[1] += 1
    bucket[2] += elapsed_ms


def flush() -> None:
    """
    Adds pending counts to the database and clears them.

    Each day's counts are added to whatever is already stored — UPDATE first,
    INSERT if there was no row — so several workers flushing the same day
    combine rather than overwrite each other.
    """
    if not _pending:
        return

    snapshot = dict(_pending)
    _pending.clear()

    db = SessionLocal()
    try:
        for day, (count, errors, total_ms) in snapshot.items():
            params = {"day": day, "c": count, "e": errors, "ms": total_ms}
            updated = db.execute(
                text(
                    "UPDATE request_stats SET request_count = request_count + :c, "
                    "error_count = error_count + :e, total_ms = total_ms + :ms "
                    "WHERE day = :day"
                ),
                params,
            ).rowcount
            if not updated:
                db.execute(
                    text(
                        "INSERT INTO request_stats (day, request_count, error_count, total_ms) "
                        "VALUES (:day, :c, :e, :ms)"
                    ),
                    params,
                )
        db.commit()
    except Exception:  # noqa: BLE001
        # Metrics must never break the app. Put the counts back to try again
        # on the next flush.
        db.rollback()
        for day, (count, errors, total_ms) in snapshot.items():
            bucket = _pending[day]
            bucket[0] += count
            bucket[1] += errors
            bucket[2] += total_ms
    finally:
        db.close()


async def flush_periodically() -> None:
    """Background loop started at app start-up."""
    while True:
        await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
        await asyncio.to_thread(flush)


async def middleware(request, call_next):
    """Times every request and counts server errors."""
    started = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        record(request.url.path, status_code, (time.perf_counter() - started) * 1000)
