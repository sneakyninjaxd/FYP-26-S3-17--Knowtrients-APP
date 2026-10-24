"""
Support requests: raised by app users, handled by User Admins on the website.

Routes are split by audience. `/support/...` is the user's own view of their
requests; `/admin/...` is the staff queue. Keeping them apart means the
ownership check on the user side is unconditional rather than a branch inside
a shared handler.

Requests come in two types, decided by category: account help (password,
account, subscription, other) and bug reports (logging, insights, profile,
account, other). Each request carries a conversation — the original
description, then messages back and forth between the user and staff.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_admin, get_current_user

user_router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _message_counts(db: Session, request_ids: list[int], reader_role: str) -> dict:
    """
    Total and unread message counts per request, in two queries rather than
    two per request.

    "Unread" means sent by the other side and not yet opened by `reader_role`
    — staff messages for the user, user messages for staff.
    """
    if not request_ids:
        return {}

    other_role = "staff" if reader_role == "user" else "user"

    totals = dict(
        db.query(models.SupportMessage.request_id, func.count(models.SupportMessage.id))
        .filter(models.SupportMessage.request_id.in_(request_ids))
        .group_by(models.SupportMessage.request_id)
        .all()
    )
    unread = dict(
        db.query(models.SupportMessage.request_id, func.count(models.SupportMessage.id))
        .filter(
            models.SupportMessage.request_id.in_(request_ids),
            models.SupportMessage.sender_role == other_role,
            models.SupportMessage.read_at.is_(None),
        )
        .group_by(models.SupportMessage.request_id)
        .all()
    )
    return {rid: (totals.get(rid, 0), unread.get(rid, 0)) for rid in request_ids}


def _to_response(
    request: models.SupportRequest, counts: tuple[int, int] = (0, 0)
) -> schemas.SupportRequestResponse:
    user = request.user
    total, unread = counts
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
        support_type=models.support_type(request.category),
        category_label=models.category_label(request.category),
        is_persisting=request.is_persisting,
        message_count=total,
        unread_count=unread,
        last_message_at=request.last_message_at,
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


def _ensure_thread(db: Session, request: models.SupportRequest) -> None:
    """
    Makes sure a request's conversation exists.

    Requests created before chat existed have no messages — only a body and
    possibly a single admin reply. The first time their thread is opened,
    those are copied in as messages, so old and new requests behave the
    same. Runs at most once per request.
    """
    has_messages = (
        db.query(models.SupportMessage.id)
        .filter(models.SupportMessage.request_id == request.id)
        .first()
    )
    if has_messages:
        return

    db.add(
        models.SupportMessage(
            request_id=request.id,
            sender_id=request.user_id,
            sender_role="user",
            body=request.body,
            created_at=request.created_at,
            # The original description was necessarily seen by whoever
            # replied, so it shouldn't show as unread to staff.
            read_at=request.replied_at,
        )
    )
    if request.reply:
        db.add(
            models.SupportMessage(
                request_id=request.id,
                sender_id=request.handled_by_id,
                sender_role="staff",
                body=request.reply,
                created_at=request.replied_at or request.created_at,
            )
        )
    db.flush()


def _thread(
    db: Session, request: models.SupportRequest, reader: models.User, reader_role: str
) -> schemas.SupportThread:
    """
    Loads a conversation and marks the other side's messages as read.

    Opening the thread is what counts as reading it, so the unread badge
    clears as soon as the user (or staff member) sees the messages.
    """
    _ensure_thread(db, request)

    other_role = "staff" if reader_role == "user" else "user"
    now = models.utcnow()
    (
        db.query(models.SupportMessage)
        .filter(
            models.SupportMessage.request_id == request.id,
            models.SupportMessage.sender_role == other_role,
            models.SupportMessage.read_at.is_(None),
        )
        .update({"read_at": now}, synchronize_session=False)
    )
    db.commit()

    messages = (
        db.query(models.SupportMessage)
        .filter(models.SupportMessage.request_id == request.id)
        .order_by(models.SupportMessage.created_at, models.SupportMessage.id)
        .all()
    )

    out = []
    for m in messages:
        # Staff are shown to users by role, not by name — the user is talking
        # to "Support", and which staff member answered isn't theirs to know.
        if m.sender_role == "staff":
            name = (
                m.sender.full_name
                if reader_role == "staff" and m.sender
                else "Knowtrients Support"
            )
        else:
            name = m.sender.full_name if m.sender else None

        out.append(
            schemas.SupportMessageResponse(
                id=m.id,
                request_id=m.request_id,
                sender_role=m.sender_role,
                sender_name=name,
                body=m.body,
                created_at=m.created_at,
                read_at=m.read_at,
                is_mine=m.sender_role == reader_role,
            )
        )

    counts = _message_counts(db, [request.id], reader_role).get(request.id, (0, 0))
    return schemas.SupportThread(request=_to_response(request, counts), messages=out)


def _post_message(
    db: Session, request: models.SupportRequest, sender: models.User, role: str, body: str
) -> models.SupportMessage:
    """Adds a message to a conversation and records the activity time."""
    _ensure_thread(db, request)

    message = models.SupportMessage(
        request_id=request.id,
        sender_id=sender.id,
        sender_role=role,
        body=body.strip(),
    )
    db.add(message)
    request.last_message_at = models.utcnow()
    return message


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
    """Raise a support request from the app's account or bug form."""
    category = payload.category
    kind = models.support_type(category)

    # For an "others" category, the user's own short description of the
    # issue becomes the subject, so staff see what it's about at a glance.
    if category in models.OTHER_CATEGORIES and payload.other_detail:
        subject = payload.other_detail.strip()
    elif payload.subject:
        subject = payload.subject.strip()
    else:
        subject = models.category_label(category)

    request = models.SupportRequest(
        user_id=current_user.id,
        category=category,
        subject=subject[:200],
        body=payload.body.strip(),
        is_persisting=payload.is_persisting if kind == "bug" else None,
        last_message_at=models.utcnow(),
    )
    db.add(request)
    db.flush()  # assigns the integer id used to build the display id
    request.display_id = _next_display_id(db)

    # The description is the first message in the conversation.
    db.add(
        models.SupportMessage(
            request_id=request.id,
            sender_id=current_user.id,
            sender_role="user",
            body=request.body,
        )
    )
    db.commit()
    db.refresh(request)
    return _to_response(request, (1, 0))


@user_router.get("/requests", response_model=list[schemas.SupportRequestResponse])
def list_my_requests(
    support_type: str | None = Query(default=None, alias="type", description="account | bug"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The user's own requests, newest activity first, with unread counts."""
    rows = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.user_id == current_user.id)
        .order_by(
            func.coalesce(
                models.SupportRequest.last_message_at, models.SupportRequest.created_at
            ).desc()
        )
        .all()
    )
    if support_type:
        rows = [r for r in rows if models.support_type(r.category) == support_type]

    counts = _message_counts(db, [r.id for r in rows], "user")
    return [_to_response(r, counts.get(r.id, (0, 0))) for r in rows]


def _own_request(db: Session, request_id: int, user: models.User) -> models.SupportRequest:
    request = (
        db.query(models.SupportRequest)
        .filter(
            models.SupportRequest.id == request_id,
            models.SupportRequest.user_id == user.id,
        )
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


@user_router.get("/requests/{request_id}/messages", response_model=schemas.SupportThread)
def my_thread(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One request's conversation. Opening it marks staff replies as read."""
    request = _own_request(db, request_id, current_user)
    return _thread(db, request, current_user, "user")


@user_router.post(
    "/requests/{request_id}/messages",
    response_model=schemas.SupportMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    request_id: int,
    payload: schemas.SupportMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sends a message on the user's own request.

    Replying to a resolved request reopens it. A user writing back is saying
    the problem isn't solved, and leaving it marked resolved would keep it out
    of the queue staff are watching.
    """
    request = _own_request(db, request_id, current_user)
    message = _post_message(db, request, current_user, "user", payload.body)

    if request.status == "resolved":
        request.status = "unresolved"
        request.resolved_at = None

    db.commit()
    db.refresh(message)
    return schemas.SupportMessageResponse(
        id=message.id,
        request_id=request.id,
        sender_role="user",
        sender_name=current_user.full_name,
        body=message.body,
        created_at=message.created_at,
        is_mine=True,
    )


@user_router.get("/unread")
def my_unread_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Total unread staff replies across all requests — for a badge."""
    count = (
        db.query(func.count(models.SupportMessage.id))
        .join(models.SupportRequest, models.SupportMessage.request_id == models.SupportRequest.id)
        .filter(
            models.SupportRequest.user_id == current_user.id,
            models.SupportMessage.sender_role == "staff",
            models.SupportMessage.read_at.is_(None),
        )
        .scalar()
    )
    return {"unread": count or 0}


# ---------------------------------------------------------------------------
# Admin queue
# ---------------------------------------------------------------------------


@admin_router.get("/requests", response_model=list[schemas.SupportRequestResponse])
def list_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    support_type: str | None = Query(default=None, alias="type", description="account | bug"),
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """The request queue, with status, type and search filters."""
    # The join must be explicit: support_requests has two foreign keys to
    # users (the requester and the admin who handled it), so SQLAlchemy cannot
    # infer which one to join on.
    query = db.query(models.SupportRequest).join(
        models.User, models.SupportRequest.user_id == models.User.id
    )

    if status_filter and status_filter.lower() != "all":
        query = query.filter(models.SupportRequest.status == status_filter.lower())

    if support_type in ("account", "bug"):
        wanted = (
            list(models.BUG_CATEGORIES)
            if support_type == "bug"
            else list(models.ACCOUNT_CATEGORIES)
        )
        wanted += [
            c for c, (kind, _) in models.LEGACY_CATEGORIES.items() if kind == support_type
        ]
        query = query.filter(models.SupportRequest.category.in_(wanted))

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
        query.order_by(
            func.coalesce(
                models.SupportRequest.last_message_at, models.SupportRequest.created_at
            ).desc()
        )
        .limit(limit)
        .all()
    )
    counts = _message_counts(db, [r.id for r in rows], "staff")
    return [_to_response(r, counts.get(r.id, (0, 0))) for r in rows]


def _any_request(db: Session, request_id: int) -> models.SupportRequest:
    request = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.id == request_id)
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


@admin_router.get("/requests/{request_id}", response_model=schemas.SupportRequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    request = _any_request(db, request_id)
    counts = _message_counts(db, [request.id], "staff").get(request.id, (0, 0))
    return _to_response(request, counts)


@admin_router.get("/requests/{request_id}/messages", response_model=schemas.SupportThread)
def staff_thread(
    request_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """A request's conversation. Opening it marks the user's messages read."""
    request = _any_request(db, request_id)
    return _thread(db, request, current_admin, "staff")


@admin_router.post(
    "/requests/{request_id}/messages",
    response_model=schemas.SupportMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def staff_message(
    request_id: int,
    payload: schemas.SupportMessageCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Sends a message on a request without resolving it — for asking the user
    a follow-up question.

    Also kept as the request's `reply`, so the app's request list and the
    admin site, which both show `reply`, display the latest staff message.
    """
    request = _any_request(db, request_id)
    message = _post_message(db, request, current_admin, "staff", payload.body)

    request.reply = message.body
    request.replied_at = models.utcnow()
    request.handled_by_id = current_admin.id

    db.commit()
    db.refresh(message)
    return schemas.SupportMessageResponse(
        id=message.id,
        request_id=request.id,
        sender_role="staff",
        sender_name=current_admin.full_name,
        body=message.body,
        created_at=message.created_at,
        is_mine=True,
    )


@admin_router.post(
    "/requests/{request_id}/reply", response_model=schemas.SupportRequestResponse
)
def reply_to_request(
    request_id: int,
    payload: schemas.SupportRequestReply,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Respond to a request, optionally marking it resolved.

    The reply is also added to the conversation, so a request answered this
    way shows the same history as one answered through the chat.
    """
    request = _any_request(db, request_id)
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
    return _to_response(request, counts)


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

    request = _any_request(db, request_id)
    request.status = new_status
    request.resolved_at = models.utcnow() if new_status == "resolved" else None
    request.handled_by_id = current_admin.id
    db.commit()
    db.refresh(request)
    counts = _message_counts(db, [request.id], "staff").get(request.id, (0, 0))
    return _to_response(request, counts)
