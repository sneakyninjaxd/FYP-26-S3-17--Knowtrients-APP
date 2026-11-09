"""
Subscription plans, in the shape the website uses.

The website reads and saves both plans together as one object:

    { "free":    { "name": ..., "price": "Free",       "features": [...] },
      "premium": { "name": ..., "price": "$10/month",  "features": [...] },
      "updated_at": ... }

and the Platform Administrator types the premium price as text, such as
"$10/month". Underneath, the price is stored as a number with a billing
period, because upgrades record the price each subscriber agreed to and the
revenue estimate needs arithmetic. So the text is read on the way in, and
rebuilt from the stored values on the way out.

The per-plan routes in subscription.py and platform.py work on the same
table; these are the ones the website calls.
"""

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_platform_admin

router = APIRouter(tags=["subscription plans"])

_PERIODS = {
    "day": 1, "daily": 1,
    "week": 7, "wk": 7, "weekly": 7,
    "month": 30, "mth": 30, "mo": 30, "monthly": 30,
    "year": 365, "yr": 365, "annum": 365, "annual": 365, "yearly": 365,
}
_PERIOD_WORD = {1: "day", 7: "week", 30: "month", 365: "year"}


def parse_price(value) -> tuple[float, int | None]:
    """
    Reads a price the Platform Administrator typed, such as "$10/month",
    "S$9.90 per month", "12.50" or 10.

    Returns (amount, period in days). The period is None when the text
    doesn't name one, meaning "keep the current period".
    """
    if isinstance(value, (int, float)):
        return round(float(value), 2), None

    text = str(value or "").strip().lower()
    match = re.search(r"(\d+(?:[.,]\d{1,2})?)", text)
    if not match:
        raise ValueError(
            'Enter the premium price as an amount, for example "$9.90/month".'
        )
    amount = round(float(match.group(1).replace(",", ".")), 2)

    period = None
    for word in re.findall(r"[a-z]+", text[match.end():]):
        if word in _PERIODS:
            period = _PERIODS[word]
            break
    return amount, period


def price_text(plan: models.SubscriptionPlan) -> str:
    """A price for display: "Free", "$10/month", "$9.90/month"."""
    if plan.plan_key == "free" or not plan.price:
        return "Free"
    amount = f"{plan.price:.0f}" if plan.price == int(plan.price) else f"{plan.price:.2f}"
    period = _PERIOD_WORD.get(plan.billing_period_days, f"{plan.billing_period_days} days")
    return f"${amount}/{period}"


def _plan_dict(plan: models.SubscriptionPlan) -> dict:
    return {
        "name": plan.name,
        "price": price_text(plan),
        "features": json.loads(plan.features or "[]"),
        # The stored values behind the text, for anything that needs numbers.
        "price_amount": plan.price,
        "currency": plan.currency,
        "billing_period_days": plan.billing_period_days,
    }


def _plans_object(db: Session) -> dict:
    plans = {p.plan_key: p for p in db.query(models.SubscriptionPlan).all()}
    missing = [k for k in models.PLAN_KEYS if k not in plans]
    if missing:
        raise HTTPException(status_code=503, detail="Subscription plans aren't set up yet.")
    latest = max((p.updated_at for p in plans.values() if p.updated_at), default=None)
    return {
        "free": _plan_dict(plans["free"]),
        "premium": _plan_dict(plans["premium"]),
        "updated_at": latest,
    }


@router.get("/plans")
def get_plans(db: Session = Depends(get_db)):
    """Both plans, for the landing page and the PA Subscription Plans page. Public."""
    return _plans_object(db)


class PlanEdit(BaseModel):
    name: str | None = None
    price: str | float | int | None = None
    features: list[str] | None = None


class PlansEdit(BaseModel):
    free: PlanEdit
    premium: PlanEdit


def _clean_features(features: list[str] | None) -> list[str]:
    return [str(f).strip() for f in (features or []) if str(f).strip()]


@router.put("/im/plans")
def save_plans(
    payload: PlansEdit,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_platform_admin),
):
    """
    Saves both plans at once, as the Subscription Plans page does.

    The free plan's price is always "Free". The premium price is read from
    the text typed; a new price applies to future upgrades only, since each
    existing subscriber's price was recorded when they signed up.
    """
    free_features = _clean_features(payload.free.features)
    premium_features = _clean_features(payload.premium.features)
    if not free_features or not premium_features:
        raise HTTPException(status_code=422, detail="Each plan needs at least one feature.")
    if len(free_features) > 20 or len(premium_features) > 20:
        raise HTTPException(status_code=422, detail="A plan can list at most 20 features.")
    if any(len(f) > 120 for f in free_features + premium_features):
        raise HTTPException(status_code=422, detail="Each feature must be 120 characters or fewer.")

    plans = {p.plan_key: p for p in db.query(models.SubscriptionPlan).all()}
    free, premium = plans.get("free"), plans.get("premium")
    if free is None or premium is None:
        raise HTTPException(status_code=503, detail="Subscription plans aren't set up yet.")

    if payload.premium.price is not None:
        try:
            amount, period = parse_price(payload.premium.price)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        if amount <= 0:
            raise HTTPException(status_code=422, detail="The premium price must be above 0.")
        if amount > 999.99:
            raise HTTPException(status_code=422, detail="The premium price must be under $1,000.")
        premium.price = amount
        if period:
            premium.billing_period_days = period

    for plan, edit, features, fallback in (
        (free, payload.free, free_features, "Free"),
        (premium, payload.premium, premium_features, "Premium"),
    ):
        name = (edit.name or "").strip()
        plan.name = (name or plan.name or fallback)[:50]
        plan.features = json.dumps(features)
        plan.updated_by_id = current_admin.id
        plan.updated_at = models.utcnow()

    free.price = 0.0
    db.commit()
    return _plans_object(db)
