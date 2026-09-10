"""
Support requests: raised by app users, handled by User Admins on the website.

Routes are split by audience. `/support/requests` is the user's own view of
their tickets; `/admin/requests` is the queue. Keeping them apart means the
ownership check on the user side is unconditional rather than a branch inside
a shared handler.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_admin, get_current_user

user_router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


def _to_response(request: models.SupportRequest) -> schemas.SupportRequestResponse:
    user = request.user
    return schemas.SupportRequestResponse(
        id=request.id,
        display_id=request.display_id,
        category=request.category,
        subject=request.subject,
        body=request.body,
        status=request.status,
        reply=request.reply,
        created_at=request.created_at,
        replied_at=request.replied_at,
        resolved_at=request.resolved_at,
        user_id=request.user_id,
        user_display_id=user.display_id if user else None,
        user_name=user.full_name if user else None,
        user_email=user.email if user else None,
        handled_by_name=request.handled_by.full_name if request.handled_by else None,
    )


def _next_display_id(db: Session) -> str:
    """Sequential ticket reference (R101, R102, ...)."""
    highest = (
        db.query(models.SupportRequest.id)
        .order_by(models.SupportRequest.id.desc())
        .first()
    )
    return f"R{100 + ((highest[0] if highest else 0) + 1)}"


# ---------------------------------------------------------------------------
# App user
# ---------------------------------------------------------------------------


@user_router.post(
    "/requests",
    response_model=schemas.SupportRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    payload: schemas.SupportRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Raise a support request from the mobile app."""
    request = models.SupportRequest(
        user_id=current_user.id,
        category=payload.category,
        subject=payload.subject.strip(),
        body=payload.body.strip(),
    )
    db.add(request)
    db.flush()  # assigns the integer id used to build the display id
    request.display_id = _next_display_id(db)
    db.commit()
    db.refresh(request)
    return _to_response(request)


@user_router.get("/requests", response_model=list[schemas.SupportRequestResponse])
def list_my_requests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The user's own tickets, newest first."""
    rows = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.user_id == current_user.id)
        .order_by(models.SupportRequest.created_at.desc())
        .all()
    )
    return [_to_response(r) for r in rows]


# ---------------------------------------------------------------------------
# Admin queue
# ---------------------------------------------------------------------------


@admin_router.get("/requests", response_model=list[schemas.SupportRequestResponse])
def list_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """The request queue, with the website's filter and search."""
    # The join must be explicit: support_requests has two foreign keys to
    # users (the requester and the admin who handled it), so SQLAlchemy cannot
    # infer which one to join on.
    query = db.query(models.SupportRequest).join(
        models.User, models.SupportRequest.user_id == models.User.id
    )

    if status_filter and status_filter.lower() != "all":
        query = query.filter(models.SupportRequest.status == status_filter.lower())

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.SupportRequest.display_id.ilike(pattern),
                models.SupportRequest.subject.ilike(pattern),
                models.User.first_name.ilike(pattern),
                models.User.last_name.ilike(pattern),
                models.User.email.ilike(pattern),
            )
        )

    rows = (
        query.order_by(models.SupportRequest.created_at.desc()).limit(limit).all()
    )
    return [_to_response(r) for r in rows]


@admin_router.get("/requests/{request_id}", response_model=schemas.SupportRequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    request = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.id == request_id)
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return _to_response(request)


@admin_router.post(
    "/requests/{request_id}/reply", response_model=schemas.SupportRequestResponse
)
def reply_to_request(
    request_id: int,
    payload: schemas.SupportRequestReply,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """Respond to a request, optionally marking it resolved."""
    request = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.id == request_id)
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    request.reply = payload.body.strip()
    request.replied_at = models.utcnow()
    request.handled_by_id = current_admin.id

    if payload.resolve:
        request.status = "resolved"
        request.resolved_at = models.utcnow()

    db.commit()
    db.refresh(request)
    return _to_response(request)


@admin_router.patch(
    "/requests/{request_id}/status", response_model=schemas.SupportRequestResponse
)
def set_request_status(
    request_id: int,
    new_status: str = Query(alias="status"),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """Resolve or reopen a request without replying."""
    if new_status not in models.REQUEST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(models.REQUEST_STATUSES)}",
        )

    request = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.id == request_id)
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    request.status = new_status
    request.resolved_at = models.utcnow() if new_status == "resolved" else None
    request.handled_by_id = current_admin.id
    db.commit()
    db.refresh(request)
    return _to_response(request)
