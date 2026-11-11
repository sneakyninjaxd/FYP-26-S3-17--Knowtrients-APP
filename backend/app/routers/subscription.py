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

import os
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


def subscription_status(subscription: models.Subscription | None) -> str:
    """
    A plain status for the admin pages: "none" (never upgraded), "active",
    "cancelled", or "expired" (premium whose period ran out).
    """
    if subscription is None:
        return "none"
    if subscription.status == "cancelled":
        return "cancelled"
    if subscription.plan == "premium" and effective_plan(subscription) == "free":
        return "expired"
    return "active" if effective_plan(subscription) == "premium" else "none"


def load_plan(db: Session, plan_key: str) -> models.SubscriptionPlan | None:
    return (
        db.query(models.SubscriptionPlan)
        .filter(models.SubscriptionPlan.plan_key == plan_key)
        .first()
    )


def plan_response(plan: models.SubscriptionPlan) -> schemas.PlanResponse:
    import json

    return schemas.PlanResponse(
        plan_key=plan.plan_key,
        name=plan.name,
        price=plan.price,
        currency=plan.currency,
        billing_period_days=plan.billing_period_days,
        features=json.loads(plan.features or "[]"),
        updated_at=plan.updated_at,
        updated_by_name=plan.updated_by.full_name if plan.updated_by else None,
    )


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
        cancels_at_period_end=plan == "premium" and subscription.cancelled_at is not None,
    )


@router.get("/plans", response_model=list[schemas.PlanResponse])
def list_plans(db: Session = Depends(get_db)):
    """
    The plans on offer, for the app's subscription screen and the website.
    Public — no sign-in needed — since prices and features are what anyone
    deciding whether to sign up should see.
    """
    plans = db.query(models.SubscriptionPlan).all()
    order = {key: i for i, key in enumerate(models.PLAN_KEYS)}
    plans.sort(key=lambda p: order.get(p.plan_key, len(order)))
    return [plan_response(p) for p in plans]


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
    # With Stripe configured, Premium only comes from a verified payment.
    # Leaving this open would make paying optional.
    from .billing import stripe_configured

    if stripe_configured():
        raise HTTPException(
            status_code=409,
            detail="Premium is purchased through checkout: POST /subscription/checkout.",
        )

    subscription = get_subscription(db, current_user.id)

    if effective_plan(subscription) == "premium":
        raise HTTPException(status_code=400, detail="You are already on Premium")

    # Price and period come from the premium plan, as set by the Platform
    # Administrator. The price is recorded on the subscription, so a later
    # price change doesn't alter what this user signed up at.
    plan = load_plan(db, "premium")
    period = timedelta(days=plan.billing_period_days) if plan else BILLING_PERIOD

    now = models.utcnow()
    if subscription is None:
        subscription = models.Subscription(user_id=current_user.id)
        db.add(subscription)

    subscription.plan = "premium"
    subscription.status = "active"
    subscription.started_at = now
    subscription.current_period_end = now + period
    subscription.cancelled_at = None
    subscription.price = plan.price if plan else None

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

    # A paid subscription is cancelled in Stripe, at the end of the period
    # already paid for. Premium continues until then; Stripe's
    # customer.subscription.deleted webhook ends it on that date.
    from .billing import stripe_configured

    if subscription.stripe_subscription_id and stripe_configured():
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        try:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id, cancel_at_period_end=True
            )
        except stripe.StripeError as exc:
            print(f"[stripe] cancel failed for user {current_user.id}: {exc}")
            raise HTTPException(status_code=502, detail="Couldn't cancel right now. Please try again.")
        subscription.cancelled_at = subscription.cancelled_at or models.utcnow()
        db.commit()
        db.refresh(subscription)
        return _response(subscription)

    # Without Stripe (local testing), cancelling takes effect immediately.
    subscription.plan = "free"
    subscription.status = "cancelled"
    subscription.cancelled_at = models.utcnow()

    db.commit()
    db.refresh(subscription)
    return _response(subscription)
