"""
Platform Administrator endpoints used by the website's PA pages.

The `/im/` prefix is historical — this area was called "IT manager" before the
roles were renamed — and is kept because the website already calls it.

Analytics
---------
The website calls its main chart "AI accuracy". There is no ground truth
saying whether a recommendation was correct, so the only real measure is
what users say about it: each point is the share of that day's rated
recommendations that users marked helpful. A day nobody rated anything is
`null` — a gap in the line — rather than zero, which would claim the
recommendations were 0% helpful.

Feedback
--------
The feedback queue is bug reports: support requests with support_type
"bug". Account requests go to Account Administrators; problems with the app
come here. Each request lives in exactly one queue, so nothing is handled
twice.
"""

from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import metrics, models, schemas
from ..database import get_db
from ..deps import get_current_platform_admin
from .subscription import effective_plan
from .support import _message_counts, _post_message, _to_response

router = APIRouter(prefix="/im", tags=["platform administrator"])

# The website's chart series, mapped to where each kind of recommendation is
# stored. Feedback rows record the domain under these keys.
_SERIES = {
    "dietary": ("diet", models.RecommendationHistory),
    "activity": ("fitness", models.FitnessRecommendationHistory),
    "sleep": ("sleep", models.SleepRecommendationHistory),
}


def _rate(up: int, down: int) -> float | None:
    """Helpful share as a percentage, or None when nothing was rated."""
    total = up + down
    return round(up / total * 100, 1) if total else None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/analytics")
def analytics(
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_admin),
):
    """
    Performance and recommendation-quality figures for the PA dashboard and
    analytics pages.

    All counts come from the database. Field names match what the website
    already reads; fields whose meaning needed correcting are described
    below, with the old name kept alongside.
    """
    # Make the request figures current before reading them.
    metrics.flush()

    today = date_type.today()
    start = today - timedelta(days=days - 1)
    day_list = [start + timedelta(days=i) for i in range(days)]
    labels = [f"{d.day}/{d.month}" for d in day_list]

    accuracy, accuracy_average, accuracy_today, accuracy_recent = {}, {}, {}, {}
    generated = likes = dislikes = 0

    for series, (domain, table) in _SERIES.items():
        # Ratings per day, joined to the recommendation they rate, grouped by
        # the day the recommendation was about.
        rows = (
            db.query(
                table.log_date,
                models.RecommendationFeedback.rating,
                func.count(models.RecommendationFeedback.id),
            )
            .join(
                table,
                (table.id == models.RecommendationFeedback.recommendation_ref)
                & (models.RecommendationFeedback.domain == domain),
            )
            .filter(table.log_date >= start, table.log_date <= today)
            .group_by(table.log_date, models.RecommendationFeedback.rating)
            .all()
        )

        per_day: dict[date_type, list[int]] = {}
        for day, rating, count in rows:
            counts = per_day.setdefault(day, [0, 0])
            counts[0 if rating == "up" else 1] += count

        accuracy[series] = [
            _rate(*per_day[d]) if d in per_day else None for d in day_list
        ]

        up = sum(c[0] for c in per_day.values())
        down = sum(c[1] for c in per_day.values())
        accuracy_average[series] = _rate(up, down)
        accuracy_today[series] = _rate(*per_day.get(today, [0, 0]))

        # The last seven days pooled — more useful as a headline than a single
        # day, which is usually empty unless the app has many users.
        week = [c for d, c in per_day.items() if d > today - timedelta(days=7)]
        accuracy_recent[series] = _rate(sum(c[0] for c in week), sum(c[1] for c in week))

        likes += up
        dislikes += down
        generated += (
            db.query(func.count(table.id))
            .filter(table.log_date >= start, table.log_date <= today)
            .scalar()
            or 0
        )

    # Premium subscribers, using the same rule as the rest of the app so an
    # expired plan isn't counted.
    subscribers = sum(
        1
        for sub in db.query(models.Subscription).filter(models.Subscription.plan == "premium")
        if effective_plan(sub) == "premium"
    )

    total_users = (
        db.query(func.count(models.User.id))
        .filter(models.User.role == models.ROLE_USER)
        .scalar()
        or 0
    )

    # Request performance from the middleware's daily counters.
    def stats_since(first_day):
        row = (
            db.query(
                func.coalesce(func.sum(models.RequestStat.request_count), 0),
                func.coalesce(func.sum(models.RequestStat.error_count), 0),
                func.coalesce(func.sum(models.RequestStat.total_ms), 0.0),
            )
            .filter(models.RequestStat.day >= first_day)
            .one()
        )
        return int(row[0]), int(row[1]), float(row[2])

    count_7d, _, ms_7d = stats_since(today - timedelta(days=6))
    count_30d, errors_30d, _ = stats_since(today - timedelta(days=29))
    _, errors_today, _ = stats_since(today)

    avg_response_ms = round(ms_7d / count_7d) if count_7d else None
    success_pct = round((1 - errors_30d / count_30d) * 100, 2) if count_30d else None

    # Bug reports — the Platform Administrator's queue.
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)

    def bugs(**filters):
        query = db.query(func.count(models.SupportRequest.id)).filter(
            models.SupportRequest.support_type == "bug"
        )
        if "status" in filters:
            query = query.filter(models.SupportRequest.status == filters["status"])
        if "since" in filters:
            query = query.filter(models.SupportRequest.created_at >= filters["since"])
        return query.scalar() or 0

    open_bugs = bugs(status="unresolved")
    resolved_bugs = bugs(status="resolved")
    new_bugs_24h = bugs(since=day_ago)

    return {
        "period_days": days,
        "labels": labels,
        # Share of rated recommendations users found helpful, per day, as a
        # percentage. null where nothing was rated that day.
        "accuracy": accuracy,
        "accuracy_today": accuracy_today,
        "accuracy_recent": accuracy_recent,      # last 7 days, pooled
        "accuracy_average": accuracy_average,    # whole period, pooled
        "insights_generated": generated,
        "likes": likes,
        "dislikes": dislikes,
        # Ratings received in the period — likes plus dislikes.
        "total_feedback": likes + dislikes,
        "unrated": max(0, generated - likes - dislikes),
        "subscribers": subscribers,
        "total_users": total_users,
        # Average response time over the last 7 days. null until there's
        # traffic to measure.
        "avg_response_ms": avg_response_ms,
        # Share of requests over 30 days that didn't fail with a server error.
        # A server can't record its own downtime, so this replaces a true
        # uptime figure. `uptime_pct` carries the same value for older pages.
        "request_success_pct": success_pct,
        "uptime_pct": success_pct,
        "server_errors_today": errors_today,
        # Bug reports created in the last 24 hours. `errors_24h` carries the
        # same value, matching the dashboard tile labelled "Bug Reports (24h)".
        "bug_reports_24h": new_bugs_24h,
        "errors_24h": new_bugs_24h,
        "open_feedback": open_bugs,
        "resolved_feedback": resolved_bugs,
    }


# ---------------------------------------------------------------------------
# Feedback — bug reports
# ---------------------------------------------------------------------------


def _feedback(request: models.SupportRequest, counts=(0, 0)) -> dict:
    """A bug report in the shape the PA feedback pages read."""
    data = _to_response(request, counts).model_dump()
    # The website shows attachments; the app doesn't upload any yet.
    data["attachments"] = []
    return data


def _bug_report(db: Session, feedback_id: int) -> models.SupportRequest:
    """Loads a bug report. Account requests aren't visible here."""
    request = (
        db.query(models.SupportRequest)
        .filter(
            models.SupportRequest.id == feedback_id,
            models.SupportRequest.support_type == "bug",
        )
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return request


@router.get("/feedback")
def list_feedback(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_admin),
):
    """The bug report queue, with status filter and search."""
    query = (
        db.query(models.SupportRequest)
        .join(models.User, models.SupportRequest.user_id == models.User.id)
        .filter(models.SupportRequest.support_type == "bug")
    )

    if status_filter and status_filter.lower() != "all":
        query = query.filter(models.SupportRequest.status == status_filter.lower())

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.SupportRequest.display_id.ilike(pattern),
                models.SupportRequest.subject.ilike(pattern),
                models.SupportRequest.body.ilike(pattern),
                models.User.first_name.ilike(pattern),
                models.User.last_name.ilike(pattern),
                models.User.email.ilike(pattern),
            )
        )

    rows = (
        query.order_by(
            func.coalesce(
                models.SupportRequest.last_message_at, models.SupportRequest.created_at
            ).desc()
        )
        .limit(limit)
        .all()
    )
    counts = _message_counts(db, [r.id for r in rows], "staff")
    return [_feedback(r, counts.get(r.id, (0, 0))) for r in rows]


@router.get("/feedback/{feedback_id}")
def get_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_admin),
):
    request = _bug_report(db, feedback_id)
    counts = _message_counts(db, [request.id], "staff").get(request.id, (0, 0))
    return _feedback(request, counts)


@router.post("/feedback/{feedback_id}/reply")
def reply_to_feedback(
    feedback_id: int,
    payload: schemas.SupportRequestReply,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_platform_admin),
):
    """
    Replies to a bug report, optionally resolving it. The reply joins the
    request's conversation, so the user sees it in the app like any other.
    """
    request = _bug_report(db, feedback_id)
    _post_message(db, request, current_admin, "staff", payload.body)

    request.reply = payload.body.strip()
    request.replied_at = models.utcnow()
    request.handled_by_id = current_admin.id
    if payload.resolve:
        request.status = "resolved"
        request.resolved_at = models.utcnow()

    db.commit()
    db.refresh(request)
    counts = _message_counts(db, [request.id], "staff").get(request.id, (0, 0))
    return _feedback(request, counts)


@router.patch("/feedback/{feedback_id}/status")
def set_feedback_status(
    feedback_id: int,
    new_status: str = Query(alias="status"),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_platform_admin),
):
    """Resolves or reopens a bug report without replying."""
    if new_status not in models.REQUEST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(models.REQUEST_STATUSES)}",
        )
    request = _bug_report(db, feedback_id)
    request.status = new_status
    request.resolved_at = models.utcnow() if new_status == "resolved" else None
    request.handled_by_id = current_admin.id
    db.commit()
    db.refresh(request)
    counts = _message_counts(db, [request.id], "staff").get(request.id, (0, 0))
    return _feedback(request, counts)
