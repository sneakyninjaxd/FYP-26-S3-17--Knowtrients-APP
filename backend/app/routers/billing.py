"""
Stripe payments for the Premium plan.

    POST /subscription/checkout   signed-in user -> { url } of a Stripe Checkout page
    POST /stripe/webhook          Stripe -> us, signature-verified

How a payment flows:

1. The app calls /subscription/checkout and opens the returned URL. The user
   pays on Stripe's own page; card details never touch this server (C-09).
2. Stripe calls /stripe/webhook with `checkout.session.completed`. That event,
   not anything the app sends, is what grants Premium.
3. On each renewal, change or cancellation, Stripe sends
   `customer.subscription.updated`, which keeps the period end in step — so
   Premium doesn't lapse while the user is still paying.
4. When the subscription finally ends, `customer.subscription.deleted`
   revokes Premium.

The webhook signature check is the security boundary. The route is public,
so without it, anyone who found the URL could post a fake "payment
succeeded" event and grant themselves Premium. The raw request bytes are
verified against STRIPE_WEBHOOK_SECRET before anything is trusted — which is
why the route reads the body directly instead of through a Pydantic model,
since re-serialised JSON wouldn't match the signature.

Every handler sets state rather than toggling it, so Stripe retrying an
event — which it does whenever a response is slow — has no extra effect.

Configuration (Render → Environment):

    STRIPE_SECRET_KEY      sk_test_... while testing, sk_live_... for real
    STRIPE_WEBHOOK_SECRET  whsec_..., from the webhook endpoint in Stripe
    STRIPE_SUCCESS_URL     where Stripe sends the user after paying (optional)
    STRIPE_CANCEL_URL      where Stripe sends them if they back out (optional)

The amount charged is the premium plan's price from the database — the one
the Platform Administrator sets on the Subscription Plans page — so what the
page shows and what Stripe charges can't drift apart.
"""

import os
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from .subscription import effective_plan, get_subscription, load_plan

router = APIRouter(tags=["payments"])

# Back into the app when checkout finishes. The path must be a real route —
# the subscription screen is at /account/subscription — or the deep link lands
# on the router's unmatched-route page. STRIPE_SUCCESS_URL and
# STRIPE_CANCEL_URL override these if the app is ever opened somewhere else.
DEFAULT_SUCCESS_URL = "knowtrients://account/subscription"
DEFAULT_CANCEL_URL = "knowtrients://account/subscription?cancelled=1"

# Billing period in days -> Stripe's recurring interval.
_INTERVALS = {1: ("day", 1), 7: ("week", 1), 30: ("month", 1), 365: ("year", 1)}


def stripe_configured() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY"))


def _use_key() -> None:
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


def _period_end(subscription_obj) -> datetime | None:
    """
    The paid-up-until time of a Stripe subscription.

    Older API versions put current_period_end on the subscription; newer ones
    (from 2025) put it on each subscription item. Both are checked, so this
    works whichever version the webhook endpoint is set to.
    """
    value = subscription_obj.get("current_period_end")
    if not value:
        items = (subscription_obj.get("items") or {}).get("data") or []
        if items:
            value = items[0].get("current_period_end")
    return datetime.fromtimestamp(value, tz=timezone.utc) if value else None


# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------


@router.post("/subscription/checkout")
def create_checkout(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Starts a Stripe Checkout for Premium and returns the page to open.

    `client_reference_id` carries the user's id through Stripe, so the
    webhook knows whose payment it is.
    """
    if not stripe_configured():
        raise HTTPException(status_code=503, detail="Payments aren't set up yet.")
    if current_user.role != models.ROLE_USER:
        raise HTTPException(status_code=403, detail="Only app users can subscribe.")

    subscription = get_subscription(db, current_user.id)
    if effective_plan(subscription) == "premium":
        raise HTTPException(status_code=400, detail="You are already on Premium.")

    plan = load_plan(db, "premium")
    if plan is None or not plan.price:
        raise HTTPException(status_code=503, detail="The Premium plan isn't priced yet.")

    interval, count = _INTERVALS.get(plan.billing_period_days, ("day", plan.billing_period_days))
    params = dict(
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": (plan.currency or "SGD").lower(),
                "unit_amount": int(round(plan.price * 100)),
                "recurring": {"interval": interval, "interval_count": count},
                "product_data": {"name": f"Knowtrients {plan.name}"},
            },
            "quantity": 1,
        }],
        client_reference_id=str(current_user.id),
        metadata={"user_id": str(current_user.id)},
        subscription_data={"metadata": {"user_id": str(current_user.id)}},
        success_url=os.getenv("STRIPE_SUCCESS_URL", DEFAULT_SUCCESS_URL),
        cancel_url=os.getenv("STRIPE_CANCEL_URL", DEFAULT_CANCEL_URL),
    )
    # A returning subscriber reuses their Stripe customer; a new one is
    # created from their email.
    if subscription is not None and subscription.stripe_customer_id:
        params["customer"] = subscription.stripe_customer_id
    else:
        params["customer_email"] = current_user.email

    _use_key()
    try:
        session = stripe.checkout.Session.create(**params)
    except stripe.StripeError as exc:
        print(f"[stripe] checkout failed for user {current_user.id}: {exc}")
        raise HTTPException(status_code=502, detail="Couldn't start the payment. Please try again.")

    return {"url": session.url, "session_id": session.id}


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives events from Stripe. Public, but every request must carry a valid
    Stripe signature over its exact bytes, or it is rejected before anything
    is read.
    """
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook isn't configured.")

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, signature, secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid signature.")

    kind = event["type"]
    obj = event["data"]["object"]

    if kind == "checkout.session.completed":
        _on_checkout_completed(db, obj)
    elif kind in ("customer.subscription.updated", "customer.subscription.created"):
        _on_subscription_updated(db, obj)
    elif kind == "customer.subscription.deleted":
        _on_subscription_deleted(db, obj)
    elif kind == "invoice.payment_failed":
        print(
            f"[stripe] payment failed: customer {obj.get('customer')}, "
            f"subscription {obj.get('subscription')}, attempt {obj.get('attempt_count')}"
        )
    # Any other event is acknowledged and ignored, so Stripe doesn't retry it.
    return {"received": True}


def _row_for(db: Session, stripe_subscription_id: str | None, user_id=None):
    """The subscription row for a Stripe subscription, by its id or the user."""
    if stripe_subscription_id:
        row = (
            db.query(models.Subscription)
            .filter(models.Subscription.stripe_subscription_id == stripe_subscription_id)
            .first()
        )
        if row is not None:
            return row
    if user_id:
        try:
            return get_subscription(db, int(user_id))
        except (TypeError, ValueError):
            return None
    return None


def _on_checkout_completed(db: Session, session) -> None:
    """Payment succeeded: grant Premium."""
    if session.get("mode") != "subscription" or session.get("payment_status") == "unpaid":
        return

    user_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("user_id")
    try:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    except (TypeError, ValueError):
        user = None
    if user is None:
        print(f"[stripe] checkout completed for unknown user {user_id!r}")
        return

    stripe_subscription_id = session.get("subscription")
    period_end = None
    if stripe_subscription_id and stripe_configured():
        try:
            _use_key()
            period_end = _period_end(stripe.Subscription.retrieve(stripe_subscription_id))
        except stripe.StripeError as exc:
            print(f"[stripe] couldn't fetch subscription {stripe_subscription_id}: {exc}")
    if period_end is None:
        # Provisional until customer.subscription.updated supplies the real one.
        plan = load_plan(db, "premium")
        period_end = models.utcnow() + timedelta(days=plan.billing_period_days if plan else 30)

    row = get_subscription(db, user.id)
    if row is None:
        row = models.Subscription(user_id=user.id)
        db.add(row)
    row.plan = "premium"
    row.status = "active"
    row.started_at = models.utcnow()
    row.current_period_end = period_end
    row.cancelled_at = None
    row.stripe_customer_id = session.get("customer") or row.stripe_customer_id
    row.stripe_subscription_id = stripe_subscription_id or row.stripe_subscription_id
    if session.get("amount_total") is not None:
        row.price = round(session["amount_total"] / 100, 2)   # what was actually paid
    db.commit()


def _on_subscription_updated(db: Session, sub) -> None:
    """Renewal, change or scheduled cancellation: keep the row in step."""
    row = _row_for(db, sub.get("id"), (sub.get("metadata") or {}).get("user_id"))
    if row is None:
        return

    status = sub.get("status")
    period_end = _period_end(sub)

    if status in ("active", "trialing"):
        row.plan = "premium"
        row.status = "active"
        row.stripe_subscription_id = sub.get("id") or row.stripe_subscription_id
        row.stripe_customer_id = sub.get("customer") or row.stripe_customer_id
        if period_end:
            row.current_period_end = period_end
        # Cancelled but still paid up: Premium continues to the period end.
        # Un-cancelled before then: clear it.
        if sub.get("cancel_at_period_end"):
            row.cancelled_at = row.cancelled_at or models.utcnow()
        else:
            row.cancelled_at = None
    elif status in ("canceled", "incomplete_expired"):
        _end(row)
    else:
        # past_due / unpaid / incomplete: Stripe is retrying the payment. The
        # period end isn't extended, so Premium lapses on its own if it fails.
        print(f"[stripe] subscription {sub.get('id')} is {status}")
    db.commit()


def _on_subscription_deleted(db: Session, sub) -> None:
    """The subscription has ended: revoke Premium."""
    row = _row_for(db, sub.get("id"), (sub.get("metadata") or {}).get("user_id"))
    if row is None:
        return
    _end(row)
    db.commit()


def _end(row: models.Subscription) -> None:
    now = models.utcnow()
    row.status = "cancelled"
    row.cancelled_at = row.cancelled_at or now
    end = row.current_period_end
    if end is not None and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end is None or end > now:
        row.current_period_end = now