"""Pydantic request and response models."""

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from .models import MEAL_TYPES


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class CreateAccountRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str
    retype_password: str

    @field_validator("retype_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    onboarding_complete: bool = False
    # The admin website checks this to reject ordinary app users at login.
    role: str = "user"
    display_id: str | None = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


class ProfileUpsert(BaseModel):
    """
    Accepts the whole onboarding flow. Every field is optional so each step can
    save as the user progresses rather than only at the end — a user who
    abandons at step 3 keeps steps 1 and 2.
    """

    date_of_birth: date | None = None
    gender: str | None = None
    height_cm: float | None = Field(default=None, ge=50, le=280)
    weight_kg: float | None = Field(default=None, ge=20, le=400)
    health_conditions: list[str] | None = None
    other_condition: str | None = None

    goals: list[str] | None = None
    other_goal: str | None = None
    target_weight_kg: float | None = Field(default=None, ge=20, le=400)

    activity_level: str | None = None
    dietary_preferences: list[str] | None = None
    other_preference: str | None = None

    onboarding_complete: bool | None = None

    @field_validator("date_of_birth")
    @classmethod
    def not_in_future(cls, v):
        if v and v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v


class ProfileResponse(BaseModel):
    date_of_birth: date | None = None
    gender: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    health_conditions: list[str] = []
    other_condition: str | None = None

    goals: list[str] = []
    other_goal: str | None = None
    target_weight_kg: float | None = None

    activity_level: str | None = None
    dietary_preferences: list[str] = []
    other_preference: str | None = None

    onboarding_complete: bool = False
    age: float | None = None
    bmi: float | None = None


# ---------------------------------------------------------------------------
# Foods
# ---------------------------------------------------------------------------


class FoodResponse(BaseModel):
    id: int
    name: str
    brand: str | None = None
    serving_description: str | None = None
    serving_grams: float | None = None
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    saturated_fat_g: float
    fiber_g: float
    sugar_g: float
    sodium_mg: float
    vegetable_servings: float

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Food logging
# ---------------------------------------------------------------------------


class FoodLogCreate(BaseModel):
    """
    Either reference a catalogue food by id (nutrition is computed server-side
    from the portion), or supply a custom entry with its own nutrition values.
    """

    meal_type: str
    log_date: date | None = None

    food_id: int | None = None
    food_name: str | None = None

    quantity: float = Field(default=1, gt=0, le=100)
    unit: str = "serving"
    grams: float | None = Field(default=None, gt=0, le=5000)

    # Only used when food_id is absent.
    calories: float | None = Field(default=None, ge=0)
    protein_g: float | None = Field(default=None, ge=0)
    carbs_g: float | None = Field(default=None, ge=0)
    fat_g: float | None = Field(default=None, ge=0)
    saturated_fat_g: float | None = Field(default=None, ge=0)
    fiber_g: float | None = Field(default=None, ge=0)
    sugar_g: float | None = Field(default=None, ge=0)
    sodium_mg: float | None = Field(default=None, ge=0)
    vegetable_servings: float | None = Field(default=None, ge=0)

    @field_validator("meal_type")
    @classmethod
    def valid_meal(cls, v):
        if v not in MEAL_TYPES:
            raise ValueError(f"meal_type must be one of: {', '.join(MEAL_TYPES)}")
        return v


class FoodLogResponse(BaseModel):
    id: int
    log_date: date
    meal_type: str
    food_name: str
    quantity: float
    unit: str
    grams: float | None = None
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    saturated_fat_g: float
    fiber_g: float
    sugar_g: float
    sodium_mg: float
    vegetable_servings: float
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class MealSummary(BaseModel):
    """Powers the meal rows on the Food Log screen."""

    meal_type: str
    label: str
    item_count: int
    calories: float


# ---------------------------------------------------------------------------
# Water, sleep, activity
# ---------------------------------------------------------------------------


class WaterLogCreate(BaseModel):
    amount_ml: float = Field(ge=0, le=10000)
    log_date: date | None = None


class SleepLogCreate(BaseModel):
    hours: float = Field(ge=0, le=24)
    quality: str | None = None
    bedtime: str | None = None
    wake_time: str | None = None
    notes: str | None = None
    log_date: date | None = None


class SleepLogResponse(BaseModel):
    id: int
    log_date: date
    hours: float
    quality: str | None = None
    bedtime: str | None = None
    wake_time: str | None = None
    notes: str | None = None

    class Config:
        from_attributes = True


class ActivityLogCreate(BaseModel):
    activity_type: str
    duration_minutes: float = Field(gt=0, le=1440)
    intensity: str | None = None
    calories_burned: float | None = Field(default=None, ge=0, le=10000)
    notes: str | None = None
    log_date: date | None = None


class ActivityLogResponse(BaseModel):
    id: int
    log_date: date
    activity_type: str
    duration_minutes: float
    intensity: str | None = None
    calories_burned: float | None = None
    notes: str | None = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Daily summary
# ---------------------------------------------------------------------------


class DailyTotals(BaseModel):
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    saturated_fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    vegetable_servings: float = 0
    water_ml: float = 0


class DailySummary(BaseModel):
    """Everything the home dashboard needs for one day, in a single call."""

    log_date: date
    totals: DailyTotals
    meals: list[MealSummary]
    sleep_hours: float | None = None
    activity_minutes: float = 0
    entry_count: int = 0


# ---------------------------------------------------------------------------
# Admin — accounts
# ---------------------------------------------------------------------------


class AdminAccountRow(BaseModel):
    """One row in the admin Accounts table."""

    id: int
    display_id: str | None = None
    first_name: str
    last_name: str
    email: EmailStr
    user_type: str          # "User" | "User Admin" | "Platform Manager"
    status: str             # "Active" | "Suspended"
    created_at: datetime | None = None


class AdminAccountDetail(AdminAccountRow):
    """The View Account page: profile summary and recent activity counts."""

    age: float | None = None
    bmi: float | None = None
    gender: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    activity_level: str | None = None
    goals: list[str] = []
    dietary_preferences: list[str] = []
    onboarding_complete: bool = False

    food_log_count: int = 0
    recommendation_count: int = 0
    last_active: datetime | None = None
    open_request_count: int = 0


class StatusUpdate(BaseModel):
    """Suspend or reactivate an account."""

    is_active: bool
    reason: str | None = None


class RoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def known_role(cls, v):
        from .models import ROLES

        if v not in ROLES:
            raise ValueError(f"role must be one of: {', '.join(ROLES)}")
        return v


class AdminDashboard(BaseModel):
    """Counts for the admin dashboard tiles."""

    total_users: int = 0
    active_users: int = 0
    suspended_users: int = 0
    user_admins: int = 0
    platform_managers: int = 0
    new_users_7d: int = 0
    unresolved_requests: int = 0
    resolved_requests: int = 0
    logs_today: int = 0
    recommendations_today: int = 0


# ---------------------------------------------------------------------------
# Support requests
# ---------------------------------------------------------------------------


class SupportRequestCreate(BaseModel):
    """Raised from the mobile app."""

    category: str = "other"
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=5000)

    @field_validator("category")
    @classmethod
    def known_category(cls, v):
        from .models import REQUEST_CATEGORIES

        if v not in REQUEST_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(REQUEST_CATEGORIES)}")
        return v


class SupportRequestReply(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    resolve: bool = True


class SupportRequestResponse(BaseModel):
    id: int
    display_id: str | None = None
    category: str
    subject: str
    body: str
    status: str
    reply: str | None = None
    created_at: datetime | None = None
    replied_at: datetime | None = None
    resolved_at: datetime | None = None

    # Denormalised for the admin list, which shows who raised each request.
    user_id: int
    user_display_id: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    handled_by_name: str | None = None

    class Config:
        from_attributes = True
