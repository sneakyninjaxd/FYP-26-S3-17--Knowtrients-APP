"""
Recommendation endpoints.

Two routes, deliberately:

* POST /recommendation      — caller supplies all ten features. Kept for
                              testing and for the Swagger demo.
* GET  /recommendation/today — the real one. The server assembles the ten
                              features from the user's logged entries and
                              stored profile, so the client never computes
                              model inputs and cannot drift from the schema.
"""

import json
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import ml_schemas, models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ml import recommender
from .logs import aggregate_day

router = APIRouter(prefix="/recommendation", tags=["recommendation"])

# Features the model needs that come from the profile rather than the logs.
PROFILE_FEATURES = ("age", "bmi")

MODEL_FEATURES = (
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "saturated_fat_g",
    "protein_g",
    "calories",
    "vegetable_servings",
    "water_ml",
)


def _persist(
    db: Session, user_id: int, log_date: date_type, features: dict, result: dict
) -> int:
    """
    Stores the recommendation with its inputs and attributions, and returns
    the new row's id — the `history_id` the app sends back with feedback.
    """
    row = (
        models.RecommendationHistory(
            user_id=user_id,
            log_date=log_date,
            recommendation_id=result["recommendation_id"],
            recommendation=result["recommendation"],
            confidence=result["confidence"],
            features=json.dumps(features),
            factors=json.dumps(result["factors"]),
            explanation=json.dumps(result["explanation"]),
            alternative=json.dumps(result.get("alternative")),
        )
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def _run(features: dict) -> dict:
    try:
        return recommender.recommend(features)
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Recommendation model is unavailable. Run ml/train_model.py to build it.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("", response_model=ml_schemas.RecommendationResponse)
def get_recommendation(
    payload: ml_schemas.RecommendationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recommendation from explicitly supplied feature values."""
    features = payload.model_dump()
    result = _run(features)
    result["history_id"] = _persist(db, current_user.id, date_type.today(), features, result)
    return result


@router.get("/today", response_model=ml_schemas.RecommendationResponse)
def get_todays_recommendation(
    log_date: date_type | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Builds the model's ten features from what the user has actually logged,
    then returns the recommendation and its SHAP explanation.
    """
    target = log_date or date_type.today()

    profile = current_user.profile
    if profile is None or profile.age is None or profile.bmi is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Complete your profile (date of birth, height and weight) "
                "before requesting a recommendation."
            ),
        )

    aggregate = aggregate_day(db, current_user.id, target)

    # A day with no food logged would otherwise be fed to the model as zeros
    # across the board, producing a confident and completely meaningless
    # recommendation. Assumption A-02 makes recommendation quality a function
    # of logging quality, so an empty day has to be refused rather than
    # silently answered.
    if aggregate["entry_count"] == 0:
        raise HTTPException(
            status_code=409,
            detail="No food logged for this date. Log at least one meal to get a recommendation.",
        )

    totals = aggregate["totals"]
    features = {name: float(totals.get(name, 0.0)) for name in MODEL_FEATURES}
    features["age"] = float(profile.age)
    features["bmi"] = float(profile.bmi)

    result = _run(features)
    result["history_id"] = _persist(db, current_user.id, target, features, result)
    return result


@router.get("/history")
def recommendation_history(
    limit: int = 30,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Past recommendations, most recent first — backs the insights screen."""
    rows = (
        db.query(models.RecommendationHistory)
        .filter(models.RecommendationHistory.user_id == current_user.id)
        .order_by(models.RecommendationHistory.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )

    return [
        {
            "id": row.id,
            "history_id": row.id,
            "log_date": row.log_date,
            "recommendation": row.recommendation,
            "recommendation_id": row.recommendation_id,
            "confidence": row.confidence,
            "explanation": json.loads(row.explanation),
            "factors": json.loads(row.factors),
            "alternative": json.loads(row.alternative) if row.alternative else None,
            "created_at": row.created_at,
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

# Where each domain's recommendations are stored, for ownership checks.
_HISTORY_TABLES = {
    "diet": models.RecommendationHistory,
    "fitness": models.FitnessRecommendationHistory,
}


def _owned_recommendation(db: Session, user_id: int, domain: str, ref: int):
    """
    Confirms the recommendation exists and belongs to this user.

    Without this, a user could attach feedback to someone else's
    recommendation by guessing ids, which would corrupt the feedback data
    Platform Managers review.
    """
    table = _HISTORY_TABLES[domain]
    row = (
        db.query(table)
        .filter(table.id == ref, table.user_id == user_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return row


@router.post("/feedback", response_model=schemas.FeedbackResponse)
def submit_feedback(
    payload: schemas.FeedbackCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records whether a recommendation was helpful.

    Rating again replaces the earlier rating, so a user who changes their
    mind is counted once rather than twice. A thumbs-down requires a reason —
    the app already asks for one, and an unexplained negative gives a
    Platform Manager nothing to act on.
    """
    _owned_recommendation(db, current_user.id, payload.domain, payload.recommendation_ref)

    reason = (payload.reason or "").strip() or None
    if payload.rating == "down" and not reason:
        raise HTTPException(
            status_code=400,
            detail="Please say what was wrong with this recommendation.",
        )

    existing = (
        db.query(models.RecommendationFeedback)
        .filter(
            models.RecommendationFeedback.user_id == current_user.id,
            models.RecommendationFeedback.domain == payload.domain,
            models.RecommendationFeedback.recommendation_ref == payload.recommendation_ref,
        )
        .first()
    )

    if existing is None:
        existing = models.RecommendationFeedback(
            user_id=current_user.id,
            domain=payload.domain,
            recommendation_ref=payload.recommendation_ref,
        )
        db.add(existing)

    existing.rating = payload.rating
    existing.reason = reason if payload.rating == "down" else None

    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/feedback", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_feedback(
    domain: str,
    recommendation_ref: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Withdraws a rating, so a mis-tap can be undone."""
    if domain not in _HISTORY_TABLES:
        raise HTTPException(status_code=400, detail="Unknown domain")

    entry = (
        db.query(models.RecommendationFeedback)
        .filter(
            models.RecommendationFeedback.user_id == current_user.id,
            models.RecommendationFeedback.domain == domain,
            models.RecommendationFeedback.recommendation_ref == recommendation_ref,
        )
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="No feedback to withdraw")

    db.delete(entry)
    db.commit()


@router.get("/feedback", response_model=list[schemas.FeedbackResponse])
def my_feedback(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The user's own ratings, so the app can restore thumbs state after a
    restart rather than showing every recommendation as unrated.
    """
    return (
        db.query(models.RecommendationFeedback)
        .filter(models.RecommendationFeedback.user_id == current_user.id)
        .order_by(models.RecommendationFeedback.created_at.desc())
        .all()
    )
