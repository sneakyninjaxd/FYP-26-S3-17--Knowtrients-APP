"""
Satisfaction check-ins: was the user satisfied with their sleep, activity or
food?

A rating covers either a whole day or one specific entry. Rating the same
day — or the same entry — again replaces the earlier rating, so a user who
changes their mind is counted once.
"""

from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/logs/satisfaction", tags=["satisfaction"])

# Which log table an entry-level rating points into, per domain.
_LOG_TABLES = {
    "food": models.FoodLog,
    "sleep": models.SleepLog,
    "activity": models.ActivityLog,
}


def _owned_entry(db: Session, user_id: int, domain: str, log_ref: int):
    """
    Confirms the entry exists and belongs to this user.

    Without this, a rating could point at another user's meal or sleep log
    by guessing ids.
    """
    table = _LOG_TABLES[domain]
    entry = (
        db.query(table)
        .filter(table.id == log_ref, table.user_id == user_id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail=f"No {domain} entry with that id")
    return entry


@router.put("", response_model=schemas.SatisfactionResponse)
def record_satisfaction(
    payload: schemas.SatisfactionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records whether the user was satisfied.

    With `log_ref`, the rating is for that one entry, and its date is taken
    from the entry itself so the two can't disagree. Without it, the rating
    covers the whole day.
    """
    log_date = payload.log_date or date_type.today()

    if payload.log_ref is not None:
        entry = _owned_entry(db, current_user.id, payload.domain, payload.log_ref)
        log_date = entry.log_date
        existing = (
            db.query(models.SatisfactionCheckin)
            .filter(
                models.SatisfactionCheckin.user_id == current_user.id,
                models.SatisfactionCheckin.domain == payload.domain,
                models.SatisfactionCheckin.log_ref == payload.log_ref,
            )
            .first()
        )
    else:
        existing = (
            db.query(models.SatisfactionCheckin)
            .filter(
                models.SatisfactionCheckin.user_id == current_user.id,
                models.SatisfactionCheckin.domain == payload.domain,
                models.SatisfactionCheckin.log_date == log_date,
                models.SatisfactionCheckin.log_ref.is_(None),
            )
            .first()
        )

    if existing is None:
        existing = models.SatisfactionCheckin(
            user_id=current_user.id,
            domain=payload.domain,
            log_date=log_date,
            log_ref=payload.log_ref,
        )
        db.add(existing)

    existing.satisfied = payload.satisfied
    existing.note = (payload.note or "").strip() or None

    db.commit()
    db.refresh(existing)
    return existing


@router.get("", response_model=list[schemas.SatisfactionResponse])
def list_satisfaction(
    days: int = Query(default=7, ge=1, le=365),
    domain: str | None = Query(default=None, description="sleep | activity | food"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The user's ratings over the last N days, newest first."""
    start = date_type.today() - timedelta(days=days - 1)
    query = db.query(models.SatisfactionCheckin).filter(
        models.SatisfactionCheckin.user_id == current_user.id,
        models.SatisfactionCheckin.log_date >= start,
    )
    if domain:
        query = query.filter(models.SatisfactionCheckin.domain == domain.lower())
    return query.order_by(
        models.SatisfactionCheckin.log_date.desc(),
        models.SatisfactionCheckin.created_at.desc(),
    ).all()


@router.get("/summary", response_model=list[schemas.SatisfactionSummary])
def satisfaction_summary(
    days: int = Query(default=30, ge=1, le=365),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """How often the user was satisfied, per domain, over the last N days."""
    start = date_type.today() - timedelta(days=days - 1)
    rows = (
        db.query(models.SatisfactionCheckin.domain, models.SatisfactionCheckin.satisfied)
        .filter(
            models.SatisfactionCheckin.user_id == current_user.id,
            models.SatisfactionCheckin.log_date >= start,
        )
        .all()
    )
    return _summarise(rows)


@router.delete("/{checkin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_satisfaction(
    checkin_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Withdraws a rating."""
    entry = (
        db.query(models.SatisfactionCheckin)
        .filter(
            models.SatisfactionCheckin.id == checkin_id,
            models.SatisfactionCheckin.user_id == current_user.id,
        )
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Rating not found")
    db.delete(entry)
    db.commit()


def _summarise(rows) -> list[schemas.SatisfactionSummary]:
    """Counts satisfied and not-satisfied per domain, every domain listed."""
    out = []
    for domain in models.SATISFACTION_DOMAINS:
        values = [satisfied for d, satisfied in rows if d == domain]
        yes = sum(1 for v in values if v)
        total = len(values)
        out.append(
            schemas.SatisfactionSummary(
                domain=domain,
                satisfied=yes,
                not_satisfied=total - yes,
                total=total,
                satisfied_rate=round(yes / total, 3) if total else None,
            )
        )
    return out
