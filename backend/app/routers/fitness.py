"""
Fitness recommendation endpoints.

The server builds the model's nine features from the user's own activity,
sleep and step logs over the past week, so the app never computes model
inputs and cannot drift from the schema — the same principle as the diet
endpoint.
"""

import json
import statistics
from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ml import fitness_recommender
from ..ml.fitness_features import (
    DEFAULT_INTENSITY,
    FEATURE_NAMES,
    INTENSITY_MAP,
    MVPA_WEIGHT,
)

router = APIRouter(prefix="/recommendation/fitness", tags=["recommendation"])

WINDOW_DAYS = 7

# Fewer logged nights than this and sleep variability can't be measured —
# the spread of one night is zero, which would read as perfect consistency.
MIN_NIGHTS_FOR_VARIABILITY = 2


def _intensity(raw: str | None) -> str:
    """Maps the app's Easy/Moderate/Intense onto guideline categories."""
    if not raw:
        return DEFAULT_INTENSITY
    return INTENSITY_MAP.get(raw.strip().lower(), DEFAULT_INTENSITY)


def build_fitness_features(db: Session, user: models.User, end: date_type) -> dict:
    """
    Assembles the model inputs for the seven days ending on `end`.

    Returns the features, which ones were imputed, how complete the week's
    data was, and the date window — everything the recommender and the
    insight card need.

    Missing data is handled differently by kind, because the meaning of
    "nothing logged" differs:

    - Activity: a day with no activity logged counts as zero activity. Rest
      days are real, and this is a reasonable reading of an empty day.
    - Sleep: everyone sleeps. A night with no entry is missing data, not
      zero sleep — reading it as zero would recommend more sleep to anyone
      who forgot to log. Averages use logged nights only.
    - Steps: only available when Health Connect is connected. With no synced
      steps, the typical value is used and the factor is flagged as imputed,
      so the explanation says so rather than presenting a guess as fact.
    """
    start = end - timedelta(days=WINDOW_DAYS - 1)

    activities = (
        db.query(models.ActivityLog)
        .filter(
            models.ActivityLog.user_id == user.id,
            models.ActivityLog.log_date >= start,
            models.ActivityLog.log_date <= end,
        )
        .all()
    )
    sleeps = (
        db.query(models.SleepLog)
        .filter(
            models.SleepLog.user_id == user.id,
            models.SleepLog.log_date >= start,
            models.SleepLog.log_date <= end,
        )
        .all()
    )
    devices = (
        db.query(models.DeviceDailyMetrics)
        .filter(
            models.DeviceDailyMetrics.user_id == user.id,
            models.DeviceDailyMetrics.log_date >= start,
            models.DeviceDailyMetrics.log_date <= end,
            models.DeviceDailyMetrics.steps.isnot(None),
        )
        .all()
    )

    # --- Activity --------------------------------------------------------
    mvpa = 0.0
    vigorous = 0.0
    strength = 0
    active_dates = set()

    for a in activities:
        level = _intensity(a.intensity)
        minutes = float(a.duration_minutes or 0)
        mvpa += minutes * MVPA_WEIGHT[level]
        if level == "vigorous":
            vigorous += minutes
        if a.activity_type and "strength" in a.activity_type.lower():
            strength += 1
        active_dates.add(a.log_date)

    # A day with plenty of steps counts as active even if no workout was
    # logged — someone who walked 10,000 steps wasn't sedentary.
    step_active_dates = {d.log_date for d in devices if (d.steps or 0) >= 7500}
    active_days = len(active_dates | step_active_dates)

    # --- Sleep -----------------------------------------------------------
    hours = [float(s.hours) for s in sleeps if s.hours is not None]

    # --- Steps -----------------------------------------------------------
    step_values = [d.steps for d in devices]

    # The recommender holds the medians; load them so imputation uses the
    # same reference the model was trained against.
    fitness_recommender._load()
    medians = fitness_recommender._medians

    imputed: set[str] = set()

    features = {
        "weekly_mvpa_minutes": round(mvpa, 1),
        "weekly_vigorous_minutes": round(vigorous, 1),
        "active_days": float(active_days),
        "strength_sessions": float(strength),
        "age": float(user.profile.age),
        "bmi": float(user.profile.bmi),
    }

    if step_values:
        features["avg_daily_steps"] = round(sum(step_values) / len(step_values))
    else:
        features["avg_daily_steps"] = float(medians["avg_daily_steps"])
        imputed.add("avg_daily_steps")

    if hours:
        features["avg_sleep_hours"] = round(sum(hours) / len(hours), 2)
    else:
        features["avg_sleep_hours"] = float(medians["avg_sleep_hours"])
        imputed.add("avg_sleep_hours")

    if len(hours) >= MIN_NIGHTS_FOR_VARIABILITY:
        features["sleep_variability"] = round(statistics.pstdev(hours), 2)
    else:
        features["sleep_variability"] = float(medians["sleep_variability"])
        imputed.add("sleep_variability")

    # Completeness: of the fourteen day-slots in the week (seven for
    # activity, seven for sleep), how many had something logged. A day with
    # synced steps counts as an activity slot — it tells us how active the
    # user was even without a workout entry.
    activity_slots = len(active_dates | {d.log_date for d in devices})
    sleep_slots = len({s.log_date for s in sleeps})
    completeness = (activity_slots + sleep_slots) / (2 * WINDOW_DAYS)

    return {
        "features": {name: features[name] for name in FEATURE_NAMES},
        "imputed": imputed,
        "completeness": round(completeness, 4),
        "window": (start, end),
        "logged_anything": bool(activities or sleeps or devices),
    }


def _to_response(row: models.FitnessRecommendationHistory, cached: bool) -> dict:
    """Rebuilds the API response from a stored history row."""
    alternative = json.loads(row.alternative) if row.alternative else {}
    insight = json.loads(row.insight) if row.insight else {}
    end = row.log_date
    start = end - timedelta(days=WINDOW_DAYS - 1)
    return {
        "history_id": row.id,
        "recommendation": row.recommendation,
        "recommendation_id": row.recommendation_id,
        "confidence": row.confidence,
        "data_completeness": row.data_completeness,
        "explanation": json.loads(row.explanation),
        "factors": json.loads(row.factors),
        "alternative": alternative,
        "next_step": insight.get("recommendation", ""),
        "insight": insight,
        "window_start": start,
        "window_end": end,
        "cached": cached,
    }


@router.get("/today", response_model=schemas.FitnessRecommendationResponse)
def fitness_today(
    log_date: date_type | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    A fitness recommendation for the week ending on `log_date` (default
    today), explained with SHAP.

    Results are reused while the week's data is unchanged. The Insights
    screen requests this every time it opens; without reuse, each visit
    would write a duplicate row to history, and feedback given on one visit
    would attach to a recommendation the user never sees again. Reuse is
    keyed on the feature values themselves, so logging, editing or deleting
    anything in the window produces a fresh recommendation automatically.
    """
    if not fitness_recommender.is_available():
        raise HTTPException(
            status_code=503,
            detail="Fitness model is unavailable. Run ml/train_fitness_model.py to build it.",
        )

    profile = current_user.profile
    if profile is None or profile.age is None or profile.bmi is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Complete your profile (date of birth, height and weight) "
                "before requesting a recommendation."
            ),
        )

    end = log_date or date_type.today()
    built = build_fitness_features(db, current_user, end)

    # Same reasoning as the diet endpoint: an empty week fed to the model as
    # zeros produces a confident "build up your activity" for someone who
    # simply hasn't logged yet. Refuse rather than guess.
    if not built["logged_anything"]:
        raise HTTPException(
            status_code=409,
            detail=(
                "No activity, sleep or steps logged in the past week. Log some "
                "activity or sleep to get a fitness recommendation."
            ),
        )

    features = built["features"]
    serialised = json.dumps(features, sort_keys=True)

    latest = (
        db.query(models.FitnessRecommendationHistory)
        .filter(
            models.FitnessRecommendationHistory.user_id == current_user.id,
            models.FitnessRecommendationHistory.log_date == end,
        )
        .order_by(models.FitnessRecommendationHistory.created_at.desc())
        .first()
    )
    if latest is not None and latest.features == serialised:
        return _to_response(latest, cached=True)

    start, finish = built["window"]
    result = fitness_recommender.recommend(
        features,
        imputed=built["imputed"],
        completeness=built["completeness"],
        window=(start.strftime("%d %b"), finish.strftime("%d %b")),
    )

    row = models.FitnessRecommendationHistory(
        user_id=current_user.id,
        log_date=end,
        recommendation_id=result["recommendation_id"],
        recommendation=result["recommendation"],
        confidence=result["confidence"],
        data_completeness=result["data_completeness"],
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
def fitness_history(
    limit: int = Query(default=30, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Past fitness recommendations, most recent first."""
    rows = (
        db.query(models.FitnessRecommendationHistory)
        .filter(models.FitnessRecommendationHistory.user_id == current_user.id)
        .order_by(models.FitnessRecommendationHistory.created_at.desc())
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
            "explanation": json.loads(r.explanation),
            "created_at": r.created_at,
        }
        for r in rows
    ]
