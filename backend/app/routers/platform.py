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
