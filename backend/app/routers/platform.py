"""
Platform Manager endpoints: system performance rather than accounts.

The division with User Admins is by subject matter. Anything about who can use
the system belongs to User Admins; anything about how well the system is
working belongs here — the nutrition catalogue the recommendations depend on,
and the metrics describing model behaviour.
"""

import json
from collections import Counter
from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_admin, get_current_platform_manager

router = APIRouter(prefix="/platform", tags=["platform"])


# ---------------------------------------------------------------------------
# Nutrition catalogue (URS 3.4)
# ---------------------------------------------------------------------------


@router.get("/foods", response_model=list[schemas.FoodResponse])
def list_foods(
    q: str | None = None,
    verified: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """
    The nutrition catalogue, with an unverified filter.

    Readable by either staff role, since a User Admin answering a support
    request about a wrong nutrition value needs to look it up.
    """
    query = db.query(models.Food)

    if q:
        query = query.filter(models.Food.name.ilike(f"%{q.strip()}%"))
    if verified is not None:
        query = query.filter(models.Food.is_verified == verified)

    return (
        query.order_by(models.Food.name).offset(offset).limit(limit).all()
    )


@router.post(
    "/foods", response_model=schemas.FoodResponse, status_code=status.HTTP_201_CREATED
)
def create_food(
    payload: schemas.FoodUpsert,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """Add a food to the catalogue."""
    if db.query(models.Food).filter(models.Food.name == payload.name.strip()).first():
        raise HTTPException(
            status_code=400, detail="A food with this name already exists"
        )

    food = models.Food(**payload.model_dump())
    food.name = food.name.strip()
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


@router.put("/foods/{food_id}", response_model=schemas.FoodResponse)
def update_food(
    food_id: int,
    payload: schemas.FoodUpsert,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    Correct a food's nutrition values.

    Existing food logs are unaffected: they store a snapshot of the nutrition
    at the time of logging, so a recommendation already explained to a user
    stays reproducible even after the source values are revised.
    """
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if food is None:
        raise HTTPException(status_code=404, detail="Food not found")

    for field, value in payload.model_dump().items():
        setattr(food, field, value)

    db.commit()
    db.refresh(food)
    return food


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food(
    food_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    Remove a food from the catalogue.

    Food logs referencing it keep their stored nutrition values; the foreign
    key is set to null rather than cascading, so a user's history survives a
    catalogue correction.
    """
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if food is None:
        raise HTTPException(status_code=404, detail="Food not found")

    db.delete(food)
    db.commit()


# ---------------------------------------------------------------------------
# System metrics
# ---------------------------------------------------------------------------


@router.get("/metrics", response_model=schemas.PlatformMetrics)
def platform_metrics(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    How the platform and the recommendation engine are performing.

    Confidence is reported as a mean and as a low-confidence count rather than
    a single figure: a healthy mean can hide a tail of predictions the model
    was unsure about, and that tail is what matters for trust in the
    explanations.
    """
    since = date_type.today() - timedelta(days=days)

    total_foods = db.query(func.count(models.Food.id)).scalar() or 0
    unverified_foods = (
        db.query(func.count(models.Food.id))
        .filter(models.Food.is_verified.is_(False))
        .scalar()
        or 0
    )

    rows = (
        db.query(
            models.RecommendationHistory.recommendation,
            models.RecommendationHistory.confidence,
        )
        .filter(models.RecommendationHistory.log_date >= since)
        .all()
    )

    total = len(rows)
    confidences = [r[1] for r in rows]
    mean_confidence = round(sum(confidences) / total, 4) if total else 0.0
    low_confidence = sum(1 for c in confidences if c < 0.6)

    distribution = [
        schemas.RecommendationCount(recommendation=name, count=count)
        for name, count in Counter(r[0] for r in rows).most_common()
    ]

    active_loggers = (
        db.query(func.count(func.distinct(models.FoodLog.user_id)))
        .filter(models.FoodLog.log_date >= since)
        .scalar()
        or 0
    )
    total_logs = (
        db.query(func.count(models.FoodLog.id))
        .filter(models.FoodLog.log_date >= since)
        .scalar()
        or 0
    )
    total_users = (
        db.query(func.count(models.User.id))
        .filter(models.User.role == models.ROLE_USER)
        .scalar()
        or 0
    )

    return schemas.PlatformMetrics(
        period_days=days,
        total_foods=total_foods,
        unverified_foods=unverified_foods,
        recommendations_served=total,
        mean_confidence=mean_confidence,
        low_confidence_count=low_confidence,
        recommendation_distribution=distribution,
        active_loggers=active_loggers,
        total_food_logs=total_logs,
        logging_rate=round(active_loggers / total_users, 3) if total_users else 0.0,
    )


@router.get("/fairness", response_model=schemas.FairnessReport)
def fairness_report(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    Whether recommendations differ systematically across user groups.

    Groups by age band and BMI category, both of which are model inputs, and
    reports the recommendation mix and mean confidence for each. A group whose
    distribution diverges sharply from the others is the signal worth
    investigating.

    This is descriptive, not a fairness guarantee. It shows what the model is
    doing across groups; deciding whether a difference is unfair needs
    dietary judgement the system does not have. While the engine runs on
    synthetic data (D-06), any disparity here reflects the generator rather
    than real-world behaviour, and the report says so.
    """
    since = date_type.today() - timedelta(days=days)

    rows = (
        db.query(
            models.RecommendationHistory.recommendation,
            models.RecommendationHistory.confidence,
            models.RecommendationHistory.features,
        )
        .filter(models.RecommendationHistory.log_date >= since)
        .all()
    )

    age_groups: dict[str, list] = {}
    bmi_groups: dict[str, list] = {}

    for recommendation, confidence, features_json in rows:
        try:
            features = json.loads(features_json)
        except (json.JSONDecodeError, TypeError):
            continue

        age = features.get("age")
        bmi = features.get("bmi")

        if age is not None:
            band = (
                "under 25" if age < 25
                else "25-39" if age < 40
                else "40-59" if age < 60
                else "60+"
            )
            age_groups.setdefault(band, []).append((recommendation, confidence))

        if bmi is not None:
            # Standard WHO categories, so the bands mean something clinically
            # rather than being arbitrary cut points.
            category = (
                "underweight" if bmi < 18.5
                else "normal" if bmi < 25
                else "overweight" if bmi < 30
                else "obese"
            )
            bmi_groups.setdefault(category, []).append((recommendation, confidence))

    def summarise(groups: dict[str, list]) -> list[schemas.FairnessGroup]:
        out = []
        for name, entries in sorted(groups.items()):
            confidences = [c for _, c in entries]
            out.append(
                schemas.FairnessGroup(
                    group=name,
                    count=len(entries),
                    mean_confidence=round(sum(confidences) / len(entries), 4),
                    distribution=[
                        schemas.RecommendationCount(recommendation=r, count=c)
                        for r, c in Counter(r for r, _ in entries).most_common()
                    ],
                )
            )
        return out

    return schemas.FairnessReport(
        period_days=days,
        total_recommendations=len(rows),
        by_age=summarise(age_groups),
        by_bmi=summarise(bmi_groups),
        caveat=(
            "Descriptive only. The recommendation engine currently runs on "
            "synthetic training data, so any disparity shown here reflects the "
            "data generator rather than real-world dietary patterns. Groups "
            "with few recommendations are not meaningful."
        ),
    )


# ---------------------------------------------------------------------------
# Recommendation feedback (Review Flagged Explanations)
# ---------------------------------------------------------------------------


@router.get("/feedback")
def review_feedback(
    rating: str | None = Query(default="down", description="up | down | all"),
    domain: str | None = Query(default=None, description="diet | fitness"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    User ratings of recommendations, newest first — thumbs-down by default.

    A thumbs-down always carries the user's reason, so each entry here says
    what the user thought was wrong. Each row includes the recommendation
    and explanation the user actually saw, so a Platform Manager can judge
    whether the complaint is about the advice or about how it was explained.

    Users are identified by display id only. Reviewing an explanation does
    not require knowing who received it.
    """
    query = db.query(models.RecommendationFeedback)
    if rating and rating != "all":
        query = query.filter(models.RecommendationFeedback.rating == rating)
    if domain:
        query = query.filter(models.RecommendationFeedback.domain == domain)

    entries = (
        query.order_by(models.RecommendationFeedback.created_at.desc())
        .limit(limit)
        .all()
    )

    tables = {
        "diet": models.RecommendationHistory,
        "fitness": models.FitnessRecommendationHistory,
        "sleep": models.SleepRecommendationHistory,
    }

    out = []
    for entry in entries:
        table = tables.get(entry.domain)
        rec = (
            db.query(table).filter(table.id == entry.recommendation_ref).first()
            if table
            else None
        )
        user = db.query(models.User).filter(models.User.id == entry.user_id).first()
        out.append(
            {
                "id": entry.id,
                "domain": entry.domain,
                "rating": entry.rating,
                "reason": entry.reason,
                "created_at": entry.created_at,
                "user_display_id": user.display_id if user else None,
                "recommendation": rec.recommendation if rec else None,
                "confidence": rec.confidence if rec else None,
                "explanation": json.loads(rec.explanation) if rec else [],
            }
        )
    return out


@router.get("/feedback/summary")
def feedback_summary(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    Helpfulness rate per recommendation type.

    Shows which kinds of advice users find least helpful, which is where a
    Platform Manager should look first when reviewing explanations.
    """
    tables = {
        "diet": models.RecommendationHistory,
        "fitness": models.FitnessRecommendationHistory,
        "sleep": models.SleepRecommendationHistory,
    }

    summary = []
    for domain, table in tables.items():
        rows = (
            db.query(
                table.recommendation,
                models.RecommendationFeedback.rating,
                func.count(models.RecommendationFeedback.id),
            )
            .join(
                table,
                (table.id == models.RecommendationFeedback.recommendation_ref)
                & (models.RecommendationFeedback.domain == domain),
            )
            .group_by(table.recommendation, models.RecommendationFeedback.rating)
            .all()
        )

        grouped: dict[str, dict] = {}
        for recommendation, rating, count in rows:
            g = grouped.setdefault(recommendation, {"up": 0, "down": 0})
            g[rating] = count

        for recommendation, counts in grouped.items():
            total = counts["up"] + counts["down"]
            summary.append(
                {
                    "domain": domain,
                    "recommendation": recommendation,
                    "helpful": counts["up"],
                    "not_helpful": counts["down"],
                    "total": total,
                    "helpful_rate": round(counts["up"] / total, 3) if total else None,
                }
            )

    summary.sort(key=lambda s: (s["helpful_rate"] is None, s["helpful_rate"] or 0))
    return summary


# ---------------------------------------------------------------------------
# User satisfaction
# ---------------------------------------------------------------------------


@router.get("/satisfaction", response_model=list[schemas.SatisfactionSummary])
def platform_satisfaction(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    How satisfied users are with their sleep, activity and food, across the
    whole platform. Aggregate counts only — no individual ratings.
    """
    from .satisfaction import _summarise

    start = date_type.today() - timedelta(days=days - 1)
    rows = (
        db.query(models.SatisfactionCheckin.domain, models.SatisfactionCheckin.satisfied)
        .filter(models.SatisfactionCheckin.log_date >= start)
        .all()
    )
    return _summarise(rows)


# ---------------------------------------------------------------------------
# Subscription plans and subscribers
# ---------------------------------------------------------------------------


@router.get("/plans", response_model=list[schemas.PlanResponse])
def platform_list_plans(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """The plans, with who last edited each — for the Subscription Plans page."""
    from .subscription import list_plans

    return list_plans(db)


@router.put("/plans/{plan_key}", response_model=schemas.PlanResponse)
def update_plan(
    plan_key: str,
    payload: schemas.PlanUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_platform_manager),
):
    """
    Edits a plan's display name, price, billing period or features.

    Plans can be edited but not added or removed: the app's features are
    built around exactly two plans, checked by key. The free plan's price is
    fixed at zero. A new premium price applies to future upgrades only —
    existing subscribers keep the price recorded when they signed up.
    """
    import json

    from .subscription import load_plan, plan_response

    plan = load_plan(db, plan_key)
    if plan is None:
        raise HTTPException(status_code=404, detail="No plan with that key.")

    if payload.price is not None and plan_key == "free" and payload.price != 0:
        raise HTTPException(status_code=400, detail="The free plan's price must stay at 0.")

    if payload.name is not None:
        plan.name = payload.name
    if payload.price is not None:
        plan.price = payload.price
    if payload.billing_period_days is not None:
        plan.billing_period_days = payload.billing_period_days
    if payload.features is not None:
        plan.features = json.dumps(payload.features)

    plan.updated_by_id = current_admin.id
    plan.updated_at = models.utcnow()
    db.commit()
    db.refresh(plan)
    return plan_response(plan)


@router.get("/subscriptions", response_model=schemas.SubscriptionOverview)
def subscription_overview(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_platform_manager),
):
    """
    How the plans are doing: subscriber counts, sign-ups and cancellations in
    the last 30 days, an estimated monthly revenue, and the subscriber list.

    Revenue is an estimate from simulated subscriptions — no payment is taken
    (C-09). Each subscriber counts at the price they signed up at, scaled to
    30 days.

    The list shows display id and name only. Account details stay with the
    Account Administrator.
    """
    from datetime import timedelta

    from .subscription import load_plan, subscription_status

    total_users = (
        db.query(func.count(models.User.id))
        .filter(models.User.role == models.ROLE_USER)
        .scalar()
        or 0
    )
    rows = (
        db.query(models.Subscription, models.User)
        .join(models.User, models.User.id == models.Subscription.user_id)
        .filter(models.User.role == models.ROLE_USER)
        .order_by(models.Subscription.started_at.desc())
        .all()
    )

    premium_plan = load_plan(db, "premium")
    period_days = premium_plan.billing_period_days if premium_plan else 30
    month_ago = models.utcnow() - timedelta(days=30)

    def aware(dt):
        if dt is not None and dt.tzinfo is None:
            return dt.replace(tzinfo=models.utcnow().tzinfo)
        return dt

    counts = {"active": 0, "cancelled": 0, "expired": 0}
    revenue = 0.0
    new_30d = cancelled_30d = 0
    subscribers = []

    for sub, user in rows:
        status = subscription_status(sub)
        if status in counts:
            counts[status] += 1
        if status == "active":
            price = sub.price if sub.price is not None else (premium_plan.price if premium_plan else 0)
            # Scale by this subscriber's own billing period, not the plan's
            # current one — a period changed later doesn't apply to them.
            own_days = period_days
            if sub.started_at and sub.current_period_end:
                own_days = max(1, round(
                    (aware(sub.current_period_end) - aware(sub.started_at)).total_seconds() / 86400
                ))
            revenue += price * 30 / own_days
        # A subscription row only exists once someone has upgraded, so every
        # row is a Premium subscription — current, cancelled or lapsed. A
        # re-upgrade resets started_at, so this counts upgrades in the window.
        started = aware(sub.started_at)
        if started and started >= month_ago:
            new_30d += 1
        cancelled_at = aware(sub.cancelled_at)
        if cancelled_at and cancelled_at >= month_ago:
            cancelled_30d += 1

        subscribers.append(
            schemas.SubscriberRow(
                user_id=user.id,
                display_id=user.display_id,
                name=user.full_name,
                plan="premium",
                status=status,
                price=sub.price,
                started_at=sub.started_at,
                current_period_end=sub.current_period_end,
                cancelled_at=sub.cancelled_at,
            )
        )

    premium = counts["active"]
    return schemas.SubscriptionOverview(
        total_users=total_users,
        premium_active=premium,
        free_users=total_users - premium,
        cancelled=counts["cancelled"],
        expired=counts["expired"],
        new_premium_30d=new_30d,
        cancelled_30d=cancelled_30d,
        premium_share=round(premium / total_users * 100, 1) if total_users else None,
        monthly_revenue_estimate=round(revenue, 2),
        currency=premium_plan.currency if premium_plan else "SGD",
        subscribers=subscribers,
    )
