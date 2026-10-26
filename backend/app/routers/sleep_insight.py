"""
Sleep recommendation endpoints.

The server builds the model's features from the user's own sleep, activity
and satisfaction logs over the past week, so the app never computes model
inputs — the same principle as the diet and fitness endpoints.
"""

import json
import statistics
from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ml import sleep_recommender
from ..ml.fitness_features import DEFAULT_INTENSITY, INTENSITY_MAP, MVPA_WEIGHT
from ..ml.sleep_features import (
    FEATURE_NAMES,
    SHORT_NIGHT_HOURS,
    bedtime_to_minutes,
    wake_to_minutes,
)

router = APIRouter(prefix="/recommendation/sleep", tags=["recommendation"])

WINDOW_DAYS = 7

# Spread can't be measured from a single night — the spread of one value is
# zero, which would read as perfect regularity.
MIN_NIGHTS_FOR_SPREAD = 2


def build_sleep_features(db: Session, user: models.User, end: date_type) -> dict:
    """
    Assembles the model inputs for the seven nights ending on `end`.

    Missing data:
    - A night with no entry is missing, not zero sleep. Averages use logged
      nights only, and completeness reports how many there were.
    - Spread (duration, bedtime, wake time) needs at least two nights. With
      fewer, the typical value is used and flagged as imputed.
    - Satisfaction comes from the user's sleep ratings. With none this week,
      the typical value is used and flagged — the explanation then says the
      user hasn't rated their sleep, rather than inventing a judgement.
    - Activity counts days with nothing logged as zero, as in the fitness
      model: rest days are real.
    """
    start = end - timedelta(days=WINDOW_DAYS - 1)

    sleeps = (
        db.query(models.SleepLog)
        .filter(
            models.SleepLog.user_id == user.id,
            models.SleepLog.log_date >= start,
            models.SleepLog.log_date <= end,
        )
        .all()
    )
    activities = (
        db.query(models.ActivityLog)
        .filter(
            models.ActivityLog.user_id == user.id,
            models.ActivityLog.log_date >= start,
            models.ActivityLog.log_date <= end,
        )
        .all()
    )
    ratings = (
        db.query(models.SatisfactionCheckin.satisfied)
        .filter(
            models.SatisfactionCheckin.user_id == user.id,
            models.SatisfactionCheckin.domain == "sleep",
            models.SatisfactionCheckin.log_date >= start,
            models.SatisfactionCheckin.log_date <= end,
        )
        .all()
    )

    hours = [float(s.hours) for s in sleeps if s.hours is not None]
    bedtimes = [m for m in (bedtime_to_minutes(s.bedtime) for s in sleeps) if m is not None]
    wakes = [m for m in (wake_to_minutes(s.wake_time) for s in sleeps) if m is not None]

    mvpa = 0.0
    for a in activities:
        level = INTENSITY_MAP.get((a.intensity or "").strip().lower(), DEFAULT_INTENSITY)
        mvpa += float(a.duration_minutes or 0) * MVPA_WEIGHT[level]

    sleep_recommender._load()
    medians = sleep_recommender._medians
    imputed: set[str] = set()

    def spread(values: list[float], name: str) -> float:
        if len(values) >= MIN_NIGHTS_FOR_SPREAD:
            return round(statistics.pstdev(values), 2)
        imputed.add(name)
        return float(medians[name])

    features = {
        "avg_sleep_hours": round(sum(hours) / len(hours), 2) if hours else float(medians["avg_sleep_hours"]),
        "short_nights": float(sum(1 for h in hours if h < SHORT_NIGHT_HOURS)),
        "duration_variability": spread(hours, "duration_variability"),
        "bedtime_variability": spread(bedtimes, "bedtime_variability"),
        "wake_variability": spread(wakes, "wake_variability"),
        "weekly_activity_minutes": round(mvpa, 1),
        "age": float(user.profile.age),
    }
    if not hours:
        imputed.add("avg_sleep_hours")

    if bedtimes:
        features["avg_bedtime"] = round(sum(bedtimes) / len(bedtimes), 1)
    else:
        features["avg_bedtime"] = float(medians["avg_bedtime"])
        imputed.add("avg_bedtime")

    if ratings:
        yes = sum(1 for (satisfied,) in ratings if satisfied)
        features["satisfaction_rate"] = round(yes / len(ratings), 3)
    else:
        features["satisfaction_rate"] = float(medians["satisfaction_rate"])
        imputed.add("satisfaction_rate")

    nights_logged = len({s.log_date for s in sleeps})

    return {
        "features": {name: features[name] for name in FEATURE_NAMES},
        "imputed": imputed,
        "completeness": round(nights_logged / WINDOW_DAYS, 4),
        "nights_logged": nights_logged,
        "window": (start, end),
    }


def _to_response(row: models.SleepRecommendationHistory, cached: bool) -> dict:
    insight = json.loads(row.insight) if row.insight else {}
    end = row.log_date
    return {
        "history_id": row.id,
        "recommendation": row.recommendation,
        "recommendation_id": row.recommendation_id,
        "confidence": row.confidence,
        "data_completeness": row.data_completeness,
        "nights_logged": row.nights_logged,
        "explanation": json.loads(row.explanation),
        "factors": json.loads(row.factors),
        "alternative": json.loads(row.alternative) if row.alternative else {},
        "next_step": insight.get("recommendation", ""),
        "insight": insight,
        "window_start": end - timedelta(days=WINDOW_DAYS - 1),
        "window_end": end,
        "cached": cached,
    }


@router.get("/today", response_model=schemas.SleepRecommendationResponse)
def sleep_today(
    log_date: date_type | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    A sleep recommendation for the seven nights ending on `log_date` (default
    today), explained with SHAP.

    Reused while the week's data is unchanged, keyed on the feature values —
    logging, editing or deleting a night, or rating one, produces a fresh
    recommendation automatically.
    """
    if not sleep_recommender.is_available():
        raise HTTPException(
            status_code=503,
            detail="Sleep model is unavailable. Run ml/train_sleep_model.py to build it.",
        )

    profile = current_user.profile
    if profile is None or profile.age is None:
        raise HTTPException(
            status_code=409,
            detail="Add your date of birth to your profile to get a sleep recommendation.",
        )

    end = log_date or date_type.today()
    built = build_sleep_features(db, current_user, end)

    if built["nights_logged"] == 0:
        raise HTTPException(
            status_code=409,
            detail="No sleep logged in the past week. Log a night's sleep to get a recommendation.",
        )

    features = built["features"]
    serialised = json.dumps(features, sort_keys=True)

    latest = (
        db.query(models.SleepRecommendationHistory)
        .filter(
            models.SleepRecommendationHistory.user_id == current_user.id,
            models.SleepRecommendationHistory.log_date == end,
        )
        .order_by(models.SleepRecommendationHistory.created_at.desc())
        .first()
    )
    if latest is not None and latest.features == serialised:
        return _to_response(latest, cached=True)

    start, finish = built["window"]
    result = sleep_recommender.recommend(
        features,
        imputed=built["imputed"],
        completeness=built["completeness"],
        window=(start.strftime("%d %b"), finish.strftime("%d %b")),
        nights_logged=built["nights_logged"],
    )

    row = models.SleepRecommendationHistory(
        user_id=current_user.id,
        log_date=end,
        recommendation_id=result["recommendation_id"],
        recommendation=result["recommendation"],
        confidence=result["confidence"],
        data_completeness=result["data_completeness"],
        nights_logged=built["nights_logged"],
        features=serialised,
        factors=json.dumps(result["factors"]),
        explanation=json.dumps(result["explanation"]),
        alternative=json.dumps(result["alternative"]),
        insight=json.dumps(result["insight"]),
        model_version=result["model_version"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row, cached=False)


@router.get("/history")
def sleep_history(
    limit: int = Query(default=30, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Past sleep recommendations, most recent first."""
    rows = (
        db.query(models.SleepRecommendationHistory)
        .filter(models.SleepRecommendationHistory.user_id == current_user.id)
        .order_by(models.SleepRecommendationHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "history_id": r.id,
            "log_date": r.log_date,
            "recommendation": r.recommendation,
            "recommendation_id": r.recommendation_id,
            "confidence": r.confidence,
            "data_completeness": r.data_completeness,
            "nights_logged": r.nights_logged,
            "explanation": json.loads(r.explanation),
            "created_at": r.created_at,
        }
        for r in rows
    ]
