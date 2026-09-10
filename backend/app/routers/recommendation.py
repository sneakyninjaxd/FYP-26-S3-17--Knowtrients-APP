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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ml_schemas, models
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
) -> None:
    """Stores the recommendation with its inputs and attributions."""
    db.add(
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
    db.commit()


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
    _persist(db, current_user.id, date_type.today(), features, result)
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
    _persist(db, current_user.id, target, features, result)
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
            "log_date": row.log_date,
            "recommendation": row.recommendation,
            "recommendation_id": row.recommendation_id,
            "confidence": row.confidence,
            "explanation": json.loads(row.explanation),
            "factors": json.loads(row.factors),
            "created_at": row.created_at,
        }
        for row in rows
    ]
