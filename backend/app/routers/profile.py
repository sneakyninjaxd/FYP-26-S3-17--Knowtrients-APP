"""
Profile endpoints backing the onboarding flow.

The client PUTs whichever fields the current step collected; unset fields are
left untouched. This lets each screen save on 'Next' rather than holding the
whole flow in memory until the final screen.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])

# Multi-selects are stored as comma-separated strings; these helpers keep the
# encoding in one place.
LIST_FIELDS = ("health_conditions", "goals", "dietary_preferences")


def _join(values: list[str] | None) -> str | None:
    return ",".join(v.strip() for v in values if v.strip()) if values else None


def _split(value: str | None) -> list[str]:
    return [v for v in value.split(",") if v] if value else []


def _to_response(profile: models.UserProfile | None) -> schemas.ProfileResponse:
    if profile is None:
        return schemas.ProfileResponse()

    return schemas.ProfileResponse(
        date_of_birth=profile.date_of_birth,
        gender=profile.gender,
        height_cm=profile.height_cm,
        weight_kg=profile.weight_kg,
        health_conditions=_split(profile.health_conditions),
        other_condition=profile.other_condition,
        goals=_split(profile.goals),
        other_goal=profile.other_goal,
        target_weight_kg=profile.target_weight_kg,
        activity_level=profile.activity_level,
        dietary_preferences=_split(profile.dietary_preferences),
        other_preference=profile.other_preference,
        onboarding_complete=profile.onboarding_complete,
        age=profile.age,
        bmi=profile.bmi,
    )


@router.get("", response_model=schemas.ProfileResponse)
def get_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the profile, or an empty one if onboarding hasn't started."""
    return _to_response(current_user.profile)


@router.put("", response_model=schemas.ProfileResponse)
def upsert_profile(
    payload: schemas.ProfileUpsert,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates or partially updates the profile."""
    profile = current_user.profile
    if profile is None:
        profile = models.UserProfile(user_id=current_user.id)
        db.add(profile)

    # exclude_unset means an omitted field is left alone, while an explicit
    # null clears it — the client can distinguish 'not on this screen' from
    # 'the user cleared this'.
    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        if field in LIST_FIELDS:
            setattr(profile, field, _join(value))
        else:
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _to_response(profile)
