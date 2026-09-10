"""
Administrative endpoints backing the companion website's admin area.

Permissions follow the two staff roles the site distinguishes:

* User Admin      — handles accounts and support requests
* Platform Manager — everything a User Admin can do, plus role changes and
                     the nutrition catalogue

Both are checked explicitly rather than through a single `is_admin` flag, so
that widening one role's powers later doesn't silently widen the other's.
"""

from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_admin, get_current_platform_manager

router = APIRouter(prefix="/admin", tags=["admin"])


def _split(value: str | None) -> list[str]:
    return [v for v in value.split(",") if v] if value else []


def _row(user: models.User) -> schemas.AdminAccountRow:
    return schemas.AdminAccountRow(
        id=user.id,
        display_id=user.display_id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        user_type=models.ROLE_LABELS.get(user.role, user.role),
        status="Active" if user.is_active else "Suspended",
        created_at=user.created_at,
    )


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------


@router.get("/accounts", response_model=list[schemas.AdminAccountRow])
def list_accounts(
    user_type: str | None = Query(default=None, description="User | User Admin | Platform Manager"),
    q: str | None = Query(default=None, description="Search id, name or email"),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """Accounts table, with the same filters the website's toolbar offers."""
    query = db.query(models.User)

    if user_type and user_type != "All":
        # The site sends display labels; map back to the stored role.
        role = next(
            (r for r, label in models.ROLE_LABELS.items() if label == user_type), user_type
        )
        query = query.filter(models.User.role == role)

    if status_filter and status_filter != "All":
        query = query.filter(models.User.is_active == (status_filter == "Active"))

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.User.display_id.ilike(pattern),
                models.User.first_name.ilike(pattern),
                models.User.last_name.ilike(pattern),
                models.User.email.ilike(pattern),
            )
        )

    users = (
        query.order_by(models.User.created_at.desc()).offset(offset).limit(limit).all()
    )
    return [_row(u) for u in users]


@router.get("/accounts/{user_id}", response_model=schemas.AdminAccountDetail)
def get_account(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """View Account page: profile summary plus activity counts."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    profile = user.profile

    food_log_count = (
        db.query(func.count(models.FoodLog.id))
        .filter(models.FoodLog.user_id == user.id)
        .scalar()
        or 0
    )
    recommendation_count = (
        db.query(func.count(models.RecommendationHistory.id))
        .filter(models.RecommendationHistory.user_id == user.id)
        .scalar()
        or 0
    )
    open_requests = (
        db.query(func.count(models.SupportRequest.id))
        .filter(
            models.SupportRequest.user_id == user.id,
            models.SupportRequest.status == "unresolved",
        )
        .scalar()
        or 0
    )
    last_active = (
        db.query(func.max(models.FoodLog.created_at))
        .filter(models.FoodLog.user_id == user.id)
        .scalar()
    )

    base = _row(user)
    return schemas.AdminAccountDetail(
        **base.model_dump(),
        age=profile.age if profile else None,
        bmi=profile.bmi if profile else None,
        gender=profile.gender if profile else None,
        height_cm=profile.height_cm if profile else None,
        weight_kg=profile.weight_kg if profile else None,
        activity_level=profile.activity_level if profile else None,
        goals=_split(profile.goals) if profile else [],
        dietary_preferences=_split(profile.dietary_preferences) if profile else [],
        onboarding_complete=bool(profile and profile.onboarding_complete),
        food_log_count=food_log_count,
        recommendation_count=recommendation_count,
        last_active=last_active,
        open_request_count=open_requests,
    )


@router.patch("/accounts/{user_id}/status", response_model=schemas.AdminAccountRow)
def set_account_status(
    user_id: int,
    payload: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """Suspend or reactivate an account (URS 3.3)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    # Locking yourself out is trivially easy and irritating to undo, since
    # recovery would need another admin or direct database access.
    if user.id == current_admin.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")

    # A User Admin managing other staff would let one admin disable another;
    # that escalation belongs with Platform Managers.
    if user.is_admin and current_admin.role != models.ROLE_PLATFORM_MANAGER:
        raise HTTPException(
            status_code=403,
            detail="Only a Platform Manager can change the status of a staff account",
        )

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return _row(user)


@router.patch("/accounts/{user_id}/role", response_model=schemas.AdminAccountRow)
def set_account_role(
    user_id: int,
    payload: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_manager: models.User = Depends(get_current_platform_manager),
):
    """Change an account's role. Platform Managers only."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if user.id == current_manager.id and payload.role != models.ROLE_PLATFORM_MANAGER:
        raise HTTPException(
            status_code=400, detail="You cannot remove your own Platform Manager role"
        )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return _row(user)


@router.delete("/accounts/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    user_id: int,
    db: Session = Depends(get_db),
    current_manager: models.User = Depends(get_current_platform_manager),
):
    """
    Permanently delete an account and everything belonging to it.

    Platform Managers only, and irreversible — cascades remove profile, logs
    and recommendation history.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.id == current_manager.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    db.delete(user)
    db.commit()


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@router.get("/dashboard", response_model=schemas.AdminDashboard)
def dashboard(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """Counts for the admin dashboard tiles."""
    today = date_type.today()
    week_ago = today - timedelta(days=7)

    def count_users(**filters):
        query = db.query(func.count(models.User.id))
        for column, value in filters.items():
            query = query.filter(getattr(models.User, column) == value)
        return query.scalar() or 0

    new_users_7d = (
        db.query(func.count(models.User.id))
        .filter(func.date(models.User.created_at) >= week_ago)
        .scalar()
        or 0
    )

    def count_requests(request_status):
        return (
            db.query(func.count(models.SupportRequest.id))
            .filter(models.SupportRequest.status == request_status)
            .scalar()
            or 0
        )

    logs_today = (
        db.query(func.count(models.FoodLog.id))
        .filter(models.FoodLog.log_date == today)
        .scalar()
        or 0
    )
    recommendations_today = (
        db.query(func.count(models.RecommendationHistory.id))
        .filter(models.RecommendationHistory.log_date == today)
        .scalar()
        or 0
    )

    return schemas.AdminDashboard(
        total_users=count_users(role=models.ROLE_USER),
        active_users=count_users(role=models.ROLE_USER, is_active=True),
        suspended_users=count_users(role=models.ROLE_USER, is_active=False),
        user_admins=count_users(role=models.ROLE_USER_ADMIN),
        platform_managers=count_users(role=models.ROLE_PLATFORM_MANAGER),
        new_users_7d=new_users_7d,
        unresolved_requests=count_requests("unresolved"),
        resolved_requests=count_requests("resolved"),
        logs_today=logs_today,
        recommendations_today=recommendations_today,
    )
