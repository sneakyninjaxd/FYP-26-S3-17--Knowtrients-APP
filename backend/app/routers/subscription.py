"""
Subscription endpoints.

Payment is simulated (constraint C-09). The app's checkout screen collects
card details to make the flow demonstrable, but none of it is sent here and
nothing payment-related is stored. Upgrading is a single call that records
the plan.

Previously the app kept `plan` only on the phone, so it reset on reinstall
and on every other device. It now lives in the `subscriptions` table and is
returned on the profile, where the app already looks for it.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/subscription", tags=["subscription"])

# Length of one simulated billing period.
BILLING_PERIOD = timedelta(days=30)


def effective_plan(subscription: models.Subscription | None) -> str:
    """
    The plan a user is actually entitled to right now.

    No subscription row means free — the free tier needs no record. A
    premium subscription past its period end lapses to free, so an expired
    plan doesn't keep granting access.
    """
    if subscription is None:
        return "free"
    if subscription.plan != "premium" or subscription.status != "active":
        return "free"
    if subscription.current_period_end is not None:
        end = subscription.current_period_end
        if end.tzinfo is None:
            end = end.replace(tzinfo=models.utcnow().tzinfo)
        if end < models.utcnow():
            return "free"
    return "premium"


def get_subscription(db: Session, user_id: int) -> models.Subscription | None:
    return (
        db.query(models.Subscription)
        .filter(models.Subscription.user_id == user_id)
        .first()
    )


def _response(subscription: models.Subscription | None) -> schemas.SubscriptionResponse:
    plan = effective_plan(subscription)
    if subscription is None:
        return schemas.SubscriptionResponse(plan=plan, is_premium=False)
    return schemas.SubscriptionResponse(
        plan=plan,
        status=subscription.status,
        started_at=subscription.started_at,
        current_period_end=subscription.current_period_end,
        cancelled_at=subscription.cancelled_at,
        is_premium=plan == "premium",
    )


@router.get("", response_model=schemas.SubscriptionResponse)
def read_subscription(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The user's current plan. Free if they have never upgraded."""
    return _response(get_subscription(db, current_user.id))


@router.post("/upgrade", response_model=schemas.SubscriptionResponse)
def upgrade(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Moves the user to Premium for one billing period.

    Simulated: no payment is taken and no card details are received. The
    request carries no body at all, so there is nothing that could be
    mistaken for payment data.
    """
    subscription = get_subscription(db, current_user.id)

    if effective_plan(subscription) == "premium":
        raise HTTPException(status_code=400, detail="You are already on Premium")

    now = models.utcnow()
    if subscription is None:
        subscription = models.Subscription(user_id=current_user.id)
        db.add(subscription)

    subscription.plan = "premium"
    subscription.status = "active"
    subscription.started_at = now
    subscription.current_period_end = now + BILLING_PERIOD
    subscription.cancelled_at = None

    db.commit()
    db.refresh(subscription)
    return _response(subscription)


@router.post("/cancel", response_model=schemas.SubscriptionResponse)
def cancel(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the user to the free plan.

    Takes effect immediately, matching the app's cancel flow. The row is kept
    rather than deleted, so the cancellation date survives for reporting.
    """
    subscription = get_subscription(db, current_user.id)

    if effective_plan(subscription) != "premium":
        raise HTTPException(status_code=400, detail="You are not on Premium")

    subscription.plan = "free"
    subscription.status = "cancelled"
    subscription.cancelled_at = models.utcnow()

    db.commit()
    db.refresh(subscription)
    return _response(subscription)
