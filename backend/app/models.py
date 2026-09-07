"""
Database models for Knowtrients.

Design notes
------------
* Timezone-aware UTC timestamps throughout (datetime.utcnow() is deprecated
  from Python 3.12 and returns a naive datetime, which causes subtle bugs when
  compared against aware values).
* `log_date` columns are plain dates, not timestamps. Daily aggregation for the
  recommendation engine groups by the user's calendar day, so storing the date
  separately avoids timezone arithmetic on every query.
* Nutrition values on FoodLog are denormalised snapshots taken at log time.
  If the nutrition source later revises a food's values, historical logs must
  not silently change — a recommendation explained to the user last week has to
  remain reproducible.
"""

from datetime import datetime, timezone, date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Users and profile
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Administrative state (supports the suspend/reactivate admin functions).
    is_active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    profile = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    food_logs = relationship("FoodLog", back_populates="user", cascade="all, delete-orphan")
    sleep_logs = relationship("SleepLog", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship(
        "ActivityLog", back_populates="user", cascade="all, delete-orphan"
    )
    recommendations = relationship(
        "RecommendationHistory", back_populates="user", cascade="all, delete-orphan"
    )


class UserProfile(Base):
    """
    Data gathered by the onboarding flow (profile(you) → (your_goal) →
    (lifestyle) → weight target → (finish)).

    One row per user, created or replaced wholesale by the onboarding flow.
    """

    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Step 1 — You
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)  # male | female | other | prefer_not_to_say
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    # Multi-select stored as a comma-separated list; small, fixed vocabulary
    # and never queried by individual element, so a join table would be
    # unnecessary complexity here.
    health_conditions = Column(String, nullable=True)
    other_condition = Column(Text, nullable=True)

    # Step 2 — Your goal
    goals = Column(String, nullable=True)
    other_goal = Column(Text, nullable=True)
    target_weight_kg = Column(Float, nullable=True)

    # Step 3 — Lifestyle
    activity_level = Column(String, nullable=True)  # sedentary | light | moderate | active | very_active
    dietary_preferences = Column(String, nullable=True)
    other_preference = Column(Text, nullable=True)

    onboarding_complete = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="profile")

    @property
    def age(self) -> float | None:
        """Age in years, derived rather than stored so it never goes stale."""
        if self.date_of_birth is None:
            return None
        today = date.today()
        years = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            years -= 1
        return float(years)

    @property
    def bmi(self) -> float | None:
        """BMI from the most recent height and weight."""
        if not self.height_cm or not self.weight_kg:
            return None
        metres = self.height_cm / 100.0
        return round(self.weight_kg / (metres * metres), 1)


# ---------------------------------------------------------------------------
# Nutrition catalogue
# ---------------------------------------------------------------------------


class Food(Base):
    """
    A food item and its nutrition per 100 g (or per 100 ml for liquids).

    Populated from the open nutrition data source. `source` and `source_ref`
    record provenance, which constraint C-06 requires — every nutritional value
    must be traceable to the designated dataset rather than estimated.
    """

    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    brand = Column(String, nullable=True)
    serving_description = Column(String, nullable=True)  # e.g. "1 bowl (250 g)"
    serving_grams = Column(Float, nullable=True)

    # Per 100 g / 100 ml.
    calories = Column(Float, nullable=False, default=0)
    protein_g = Column(Float, nullable=False, default=0)
    carbs_g = Column(Float, nullable=False, default=0)
    fat_g = Column(Float, nullable=False, default=0)
    saturated_fat_g = Column(Float, nullable=False, default=0)
    fiber_g = Column(Float, nullable=False, default=0)
    sugar_g = Column(Float, nullable=False, default=0)
    sodium_mg = Column(Float, nullable=False, default=0)
    vegetable_servings = Column(Float, nullable=False, default=0)

    source = Column(String, nullable=True)
    source_ref = Column(String, nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

MEAL_TYPES = (
    "breakfast",
    "morning_snack",
    "lunch",
    "afternoon_snack",
    "dinner",
    "evening_snack",
)


class FoodLog(Base):
    """One food item logged against a meal on a given day."""

    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)

    log_date = Column(Date, nullable=False, default=date.today)
    meal_type = Column(String, nullable=False)

    # What the user actually ate.
    food_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False, default=1)
    unit = Column(String, nullable=False, default="serving")
    grams = Column(Float, nullable=True)

    # Snapshot of the computed nutrition for this portion.
    calories = Column(Float, nullable=False, default=0)
    protein_g = Column(Float, nullable=False, default=0)
    carbs_g = Column(Float, nullable=False, default=0)
    fat_g = Column(Float, nullable=False, default=0)
    saturated_fat_g = Column(Float, nullable=False, default=0)
    fiber_g = Column(Float, nullable=False, default=0)
    sugar_g = Column(Float, nullable=False, default=0)
    sodium_mg = Column(Float, nullable=False, default=0)
    vegetable_servings = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="food_logs")
    food = relationship("Food")

    __table_args__ = (
        Index("ix_food_logs_user_date", "user_id", "log_date"),
    )


class WaterLog(Base):
    """
    Daily water intake. Separate from FoodLog because the UI treats it as a
    single running total for the day rather than a list of entries, and
    water_ml is one of the ten model features.
    """

    __tablename__ = "water_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    log_date = Column(Date, nullable=False, default=date.today)
    amount_ml = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "log_date", name="uq_water_user_date"),
    )


class SleepLog(Base):
    """
    Manual sleep entry (PU07). Logged as context for nutrition recommendations
    rather than tracked as a health outcome in its own right.
    """

    __tablename__ = "sleep_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    log_date = Column(Date, nullable=False, default=date.today)

    hours = Column(Float, nullable=False)
    quality = Column(String, nullable=True)  # poor | fair | good | excellent
    bedtime = Column(String, nullable=True)  # "23:30"
    wake_time = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="sleep_logs")

    __table_args__ = (
        UniqueConstraint("user_id", "log_date", name="uq_sleep_user_date"),
    )


class ActivityLog(Base):
    """Physical activity, logged as context for nutrition recommendations."""

    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    log_date = Column(Date, nullable=False, default=date.today)

    activity_type = Column(String, nullable=False)
    duration_minutes = Column(Float, nullable=False)
    intensity = Column(String, nullable=True)  # light | moderate | vigorous
    calories_burned = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="activity_logs")

    __table_args__ = (
        Index("ix_activity_logs_user_date", "user_id", "log_date"),
    )


# ---------------------------------------------------------------------------
# Recommendation history
# ---------------------------------------------------------------------------


class RecommendationHistory(Base):
    """
    Every recommendation served, with the exact inputs and SHAP attributions
    that produced it.

    Storing the explanation rather than regenerating it matters: model
    artefacts are versioned (C-04), so a later model would produce different
    attributions for the same inputs. A recommendation shown to a user must
    remain explainable as it was shown.
    """

    __tablename__ = "recommendation_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    log_date = Column(Date, nullable=False, default=date.today)

    recommendation_id = Column(Integer, nullable=False)
    recommendation = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)

    # JSON-serialised: the ten feature values, the SHAP factors, the
    # explanation sentences, and the runner-up class.
    features = Column(Text, nullable=False)
    factors = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    alternative = Column(Text, nullable=True)

    model_version = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="recommendations")

    __table_args__ = (
        Index("ix_reco_user_date", "user_id", "log_date"),
    )
