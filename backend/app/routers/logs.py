"""
Logging endpoints: food, water, sleep and activity, plus the aggregated daily
summary that the home dashboard and the recommendation engine both read.
"""

from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(tags=["logs"])

MEAL_LABELS = {
    "breakfast": "Breakfast",
    "morning_snack": "Morning Snack",
    "lunch": "Lunch",
    "afternoon_snack": "Afternoon Snack",
    "dinner": "Dinner",
    "evening_snack": "Evening Snack",
}

NUTRIENT_FIELDS = (
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "saturated_fat_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "vegetable_servings",
)


# ---------------------------------------------------------------------------
# Foods
# ---------------------------------------------------------------------------


@router.get("/foods/search", response_model=list[schemas.FoodResponse])
def search_foods(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Backs the food search screen."""
    pattern = f"%{q.strip()}%"
    return (
        db.query(models.Food)
        .filter(models.Food.name.ilike(pattern))
        # Verified entries from the nutrition source rank above user-submitted
        # ones, per constraint C-06.
        .order_by(models.Food.is_verified.desc(), models.Food.name)
        .limit(limit)
        .all()
    )


@router.get("/foods/{food_id}", response_model=schemas.FoodResponse)
def get_food(
    food_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if food is None:
        raise HTTPException(status_code=404, detail="Food not found")
    return food


# ---------------------------------------------------------------------------
# Food logging
# ---------------------------------------------------------------------------


def _nutrition_for_portion(food: models.Food, grams: float) -> dict:
    """Scales a catalogue food's per-100 g values to the portion eaten."""
    factor = grams / 100.0
    return {field: round(getattr(food, field) * factor, 2) for field in NUTRIENT_FIELDS}


@router.post(
    "/logs/food", response_model=schemas.FoodLogResponse, status_code=status.HTTP_201_CREATED
)
def create_food_log(
    payload: schemas.FoodLogCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logs one food item. Nutrition is computed server-side from the catalogue
    entry so the client can't submit values that don't match the source data.
    """
    log_date = payload.log_date or date_type.today()

    if payload.food_id is not None:
        food = db.query(models.Food).filter(models.Food.id == payload.food_id).first()
        if food is None:
            raise HTTPException(status_code=404, detail="Food not found")

        # Prefer explicit grams; otherwise fall back to the food's serving size.
        if payload.grams is not None:
            grams = payload.grams
        elif food.serving_grams:
            grams = food.serving_grams * payload.quantity
        else:
            grams = 100.0 * payload.quantity

        nutrition = _nutrition_for_portion(food, grams)
        entry = models.FoodLog(
            user_id=current_user.id,
            food_id=food.id,
            log_date=log_date,
            meal_type=payload.meal_type,
            food_name=food.name,
            quantity=payload.quantity,
            unit=payload.unit,
            grams=grams,
            **nutrition,
        )
    else:
        if not payload.food_name:
            raise HTTPException(
                status_code=400,
                detail="Either food_id or food_name with nutrition values must be supplied",
            )
        entry = models.FoodLog(
            user_id=current_user.id,
            log_date=log_date,
            meal_type=payload.meal_type,
            food_name=payload.food_name.strip(),
            quantity=payload.quantity,
            unit=payload.unit,
            grams=payload.grams,
            **{f: (getattr(payload, f) or 0) for f in NUTRIENT_FIELDS},
        )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/logs/food", response_model=list[schemas.FoodLogResponse])
def list_food_logs(
    log_date: date_type | None = None,
    meal_type: str | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Entries for one day, optionally filtered to a single meal."""
    query = db.query(models.FoodLog).filter(
        models.FoodLog.user_id == current_user.id,
        models.FoodLog.log_date == (log_date or date_type.today()),
    )
    if meal_type:
        query = query.filter(models.FoodLog.meal_type == meal_type)
    return query.order_by(models.FoodLog.created_at).all()


@router.delete("/logs/food/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food_log(
    log_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(models.FoodLog)
        .filter(models.FoodLog.id == log_id, models.FoodLog.user_id == current_user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Log entry not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Water
# ---------------------------------------------------------------------------


@router.put("/logs/water", response_model=schemas.WaterLogCreate)
def set_water_log(
    payload: schemas.WaterLogCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sets the day's water total (one row per user per day)."""
    log_date = payload.log_date or date_type.today()
    entry = (
        db.query(models.WaterLog)
        .filter(models.WaterLog.user_id == current_user.id, models.WaterLog.log_date == log_date)
        .first()
    )
    if entry is None:
        entry = models.WaterLog(user_id=current_user.id, log_date=log_date)
        db.add(entry)

    entry.amount_ml = payload.amount_ml
    db.commit()
    return schemas.WaterLogCreate(amount_ml=entry.amount_ml, log_date=entry.log_date)


# ---------------------------------------------------------------------------
# Sleep
# ---------------------------------------------------------------------------


@router.put("/logs/sleep", response_model=schemas.SleepLogResponse)
def upsert_sleep_log(
    payload: schemas.SleepLogCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Records or replaces the night's sleep for a date (PU07, manual entry)."""
    log_date = payload.log_date or date_type.today()
    entry = (
        db.query(models.SleepLog)
        .filter(models.SleepLog.user_id == current_user.id, models.SleepLog.log_date == log_date)
        .first()
    )
    if entry is None:
        entry = models.SleepLog(user_id=current_user.id, log_date=log_date, hours=payload.hours)
        db.add(entry)

    for field in ("hours", "quality", "bedtime", "wake_time", "notes"):
        value = getattr(payload, field)
        if value is not None:
            setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.get("/logs/sleep", response_model=list[schemas.SleepLogResponse])
def list_sleep_logs(
    days: int = Query(default=7, ge=1, le=90),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.SleepLog)
        .filter(models.SleepLog.user_id == current_user.id)
        .order_by(models.SleepLog.log_date.desc())
        .limit(days)
        .all()
    )


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------


@router.post(
    "/logs/activity",
    response_model=schemas.ActivityLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity_log(
    payload: schemas.ActivityLogCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = models.ActivityLog(
        user_id=current_user.id,
        log_date=payload.log_date or date_type.today(),
        activity_type=payload.activity_type.strip(),
        duration_minutes=payload.duration_minutes,
        intensity=payload.intensity,
        calories_burned=payload.calories_burned,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/logs/activity", response_model=list[schemas.ActivityLogResponse])
def list_activity_logs(
    log_date: date_type | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.ActivityLog)
        .filter(
            models.ActivityLog.user_id == current_user.id,
            models.ActivityLog.log_date == (log_date or date_type.today()),
        )
        .order_by(models.ActivityLog.created_at)
        .all()
    )


@router.delete("/logs/activity/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_log(
    log_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.id == log_id, models.ActivityLog.user_id == current_user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Log entry not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Daily aggregation
# ---------------------------------------------------------------------------


def aggregate_day(db: Session, user_id: int, log_date: date_type) -> dict:
    """
    Sums a user's logged intake for one day.

    Shared by the dashboard summary and the recommendation endpoint, so the
    numbers a user sees and the numbers the model receives are guaranteed to be
    the same. Aggregation runs in SQL rather than in Python because a heavy
    logging day could otherwise pull hundreds of rows across the wire.
    """
    columns = [func.coalesce(func.sum(getattr(models.FoodLog, f)), 0.0) for f in NUTRIENT_FIELDS]
    row = (
        db.query(*columns, func.count(models.FoodLog.id))
        .filter(models.FoodLog.user_id == user_id, models.FoodLog.log_date == log_date)
        .one()
    )

    totals = {field: float(row[i]) for i, field in enumerate(NUTRIENT_FIELDS)}
    entry_count = int(row[-1])

    water = (
        db.query(models.WaterLog.amount_ml)
        .filter(models.WaterLog.user_id == user_id, models.WaterLog.log_date == log_date)
        .scalar()
    )
    totals["water_ml"] = float(water or 0)

    sleep = (
        db.query(models.SleepLog.hours)
        .filter(models.SleepLog.user_id == user_id, models.SleepLog.log_date == log_date)
        .scalar()
    )

    activity_minutes = (
        db.query(func.coalesce(func.sum(models.ActivityLog.duration_minutes), 0.0))
        .filter(models.ActivityLog.user_id == user_id, models.ActivityLog.log_date == log_date)
        .scalar()
    )

    return {
        "totals": totals,
        "entry_count": entry_count,
        "sleep_hours": float(sleep) if sleep is not None else None,
        "activity_minutes": float(activity_minutes or 0),
    }


@router.get("/logs/summary", response_model=schemas.DailySummary)
def daily_summary(
    log_date: date_type | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One call for the whole dashboard: totals, per-meal rows, sleep, activity."""
    target = log_date or date_type.today()
    aggregate = aggregate_day(db, current_user.id, target)

    per_meal = dict(
        db.query(
            models.FoodLog.meal_type,
            func.count(models.FoodLog.id),
        )
        .filter(models.FoodLog.user_id == current_user.id, models.FoodLog.log_date == target)
        .group_by(models.FoodLog.meal_type)
        .all()
    )
    per_meal_calories = dict(
        db.query(
            models.FoodLog.meal_type,
            func.coalesce(func.sum(models.FoodLog.calories), 0.0),
        )
        .filter(models.FoodLog.user_id == current_user.id, models.FoodLog.log_date == target)
        .group_by(models.FoodLog.meal_type)
        .all()
    )

    # Every meal is returned, including empty ones, so the client renders a
    # stable six-row list rather than a list that changes shape as it fills.
    meals = [
        schemas.MealSummary(
            meal_type=meal_type,
            label=label,
            item_count=int(per_meal.get(meal_type, 0)),
            calories=round(float(per_meal_calories.get(meal_type, 0)), 1),
        )
        for meal_type, label in MEAL_LABELS.items()
    ]

    return schemas.DailySummary(
        log_date=target,
        totals=schemas.DailyTotals(**aggregate["totals"]),
        meals=meals,
        sleep_hours=aggregate["sleep_hours"],
        activity_minutes=aggregate["activity_minutes"],
        entry_count=aggregate["entry_count"],
    )
