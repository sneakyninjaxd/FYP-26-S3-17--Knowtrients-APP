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
    # Read from the subscriptions table. Included here because the app keeps
    # `plan` on its profile object; previously it was held only on the phone.
    plan: str = "free"


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
    """
    Raised from the mobile app's account-help or bug-report form.

    `category` decides the type: account categories (password, account,
    subscription, account_other) or bug categories (bug_logging,
    bug_insights, bug_profile, bug_account, bug_other).

    `subject` is optional. Left out, it defaults to the category's label. For
    an "others" category, `other_detail` carries the user's own short
    description of the issue and becomes the subject.

    `is_persisting` applies to bug reports only and is ignored for account
    requests.
    """

    category: str = "account_other"
    subject: str | None = Field(default=None, min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=5000)
    other_detail: str | None = Field(default=None, max_length=200)
    is_persisting: bool | None = None

    @field_validator("category", mode="before")
    @classmethod
    def normalise_category(cls, v):
        """
        Accepts the ids the app already sends — "account-others",
        "bug-other" — by normalising hyphens and the plural. This lets the
        existing account form work without an app update.
        """
        from .models import REQUEST_CATEGORIES

        if v is None:
            return "account_other"

        key = str(v).strip().lower().replace("-", "_")
        key = {"account_others": "account_other", "bug_others": "bug_other"}.get(key, key)

        if key not in REQUEST_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(REQUEST_CATEGORIES)}")
        return key


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

    # Derived from the category, so the app and admin site can group and
    # label requests without keeping their own category tables.
    support_type: str = "account"          # account | bug
    category_label: str = ""
    is_persisting: bool | None = None

    # Chat. `unread_count` is messages from the other side not yet read by
    # whoever is asking — the user in the app, staff on the admin site.
    message_count: int = 0
    unread_count: int = 0
    last_message_at: datetime | None = None

    # Denormalised for the admin list, which shows who raised each request.
    user_id: int
    user_display_id: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    handled_by_name: str | None = None

    class Config:
        from_attributes = True


class SupportMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class SupportMessageResponse(BaseModel):
    id: int
    request_id: int
    sender_role: str           # user | staff
    sender_name: str | None = None
    body: str
    created_at: datetime | None = None
    read_at: datetime | None = None
    is_mine: bool = False


class SupportThread(BaseModel):
    """A support request with its full conversation."""

    request: SupportRequestResponse
    messages: list[SupportMessageResponse]


# ---------------------------------------------------------------------------
# Satisfaction
# ---------------------------------------------------------------------------


class SatisfactionCreate(BaseModel):
    """
    Rates the user's sleep, activity or food as satisfied or not.

    Leave `log_ref` out to rate the whole day; set it to a specific log's id
    to rate one meal, night or workout.
    """

    domain: str
    satisfied: bool
    log_date: date | None = None
    log_ref: int | None = None
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("domain")
    @classmethod
    def known_domain(cls, v):
        from .models import SATISFACTION_DOMAINS

        v = v.strip().lower()
        # The app labels the activity screen "Activities".
        v = {"activities": "activity", "meal": "food", "meals": "food"}.get(v, v)
        if v not in SATISFACTION_DOMAINS:
            raise ValueError(f"domain must be one of: {', '.join(SATISFACTION_DOMAINS)}")
        return v


class SatisfactionResponse(BaseModel):
    id: int
    domain: str
    log_date: date
    log_ref: int | None = None
    satisfied: bool
    note: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class SatisfactionSummary(BaseModel):
    """Satisfaction rate for one domain over a period."""

    domain: str
    satisfied: int = 0
    not_satisfied: int = 0
    total: int = 0
    satisfied_rate: float | None = None


# ---------------------------------------------------------------------------
# Platform Manager — catalogue and metrics
# ---------------------------------------------------------------------------


class FoodUpsert(BaseModel):
    """Create or correct a catalogue entry. Values are per 100 g / 100 ml."""

    name: str = Field(min_length=1, max_length=200)
    brand: str | None = None
    serving_description: str | None = None
    serving_grams: float | None = Field(default=None, gt=0, le=5000)

    calories: float = Field(default=0, ge=0)
    protein_g: float = Field(default=0, ge=0)
    carbs_g: float = Field(default=0, ge=0)
    fat_g: float = Field(default=0, ge=0)
    saturated_fat_g: float = Field(default=0, ge=0)
    fiber_g: float = Field(default=0, ge=0)
    sugar_g: float = Field(default=0, ge=0)
    sodium_mg: float = Field(default=0, ge=0)
    vegetable_servings: float = Field(default=0, ge=0)

    source: str | None = None
    source_ref: str | None = None
    is_verified: bool = False


class RecommendationCount(BaseModel):
    recommendation: str
    count: int


class PlatformMetrics(BaseModel):
    period_days: int
    total_foods: int = 0
    unverified_foods: int = 0
    recommendations_served: int = 0
    mean_confidence: float = 0.0
    low_confidence_count: int = 0
    recommendation_distribution: list[RecommendationCount] = []
    active_loggers: int = 0
    total_food_logs: int = 0
    logging_rate: float = 0.0


class FairnessGroup(BaseModel):
    group: str
    count: int
    mean_confidence: float
    distribution: list[RecommendationCount] = []


class FairnessReport(BaseModel):
    period_days: int
    total_recommendations: int = 0
    by_age: list[FairnessGroup] = []
    by_bmi: list[FairnessGroup] = []
    caveat: str


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------


class SubscriptionResponse(BaseModel):
    plan: str = "free"
    status: str = "active"
    started_at: datetime | None = None
    current_period_end: datetime | None = None
    cancelled_at: datetime | None = None
    is_premium: bool = False


# ---------------------------------------------------------------------------
# Recommendation feedback
# ---------------------------------------------------------------------------


class FeedbackCreate(BaseModel):
    """
    Rates one recommendation.

    `recommendation_ref` is the `history_id` returned with the recommendation
    — not `recommendation_id`, which identifies the *kind* of advice and is
    shared by every user who received it.
    """

    domain: str = "diet"
    recommendation_ref: int
    rating: str
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("domain")
    @classmethod
    def known_domain(cls, v):
        from .models import RECOMMENDATION_DOMAINS

        if v not in RECOMMENDATION_DOMAINS:
            raise ValueError(f"domain must be one of: {', '.join(RECOMMENDATION_DOMAINS)}")
        return v

    @field_validator("rating")
    @classmethod
    def known_rating(cls, v):
        from .models import FEEDBACK_RATINGS

        if v not in FEEDBACK_RATINGS:
            raise ValueError(f"rating must be one of: {', '.join(FEEDBACK_RATINGS)}")
        return v


class FeedbackResponse(BaseModel):
    id: int
    domain: str
    recommendation_ref: int
    rating: str
    reason: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Device metrics (Health Connect)
# ---------------------------------------------------------------------------


class DeviceMetricsCreate(BaseModel):
    steps: int | None = Field(default=None, ge=0, le=150000)
    active_calories: float | None = Field(default=None, ge=0, le=20000)
    source: str = "health_connect"
    log_date: date | None = None


class DeviceMetricsResponse(BaseModel):
    log_date: date
    steps: int | None = None
    active_calories: float | None = None
    source: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Activity range
# ---------------------------------------------------------------------------


class ActivityDay(BaseModel):
    """One day in a range, with logged activity and any synced steps."""

    date: date
    minutes: float = 0
    calories: float = 0
    count: int = 0
    steps: int | None = None


# ---------------------------------------------------------------------------
# Fitness recommendation
# ---------------------------------------------------------------------------


class FitnessFactor(BaseModel):
    feature: str
    label: str
    value: float
    contribution: float
    direction: str
    imputed: bool = False


class FitnessAlternative(BaseModel):
    recommendation: str
    confidence: float


class FitnessRecommendationResponse(BaseModel):
    """
    Same core shape as the diet recommendation, so the app can render both
    with one component, plus three fitness-specific fields:

    - data_completeness: share of the week that was logged (0-1). Reported
      separately from confidence so a barely-logged week can't pass as a
      certain one.
    - next_step: a concrete action sized from the user's own numbers.
    - insight: the result shaped like an entry in the app's src/insights.js,
      ready to replace the hardcoded Activity card.
    """

    history_id: int | None = None
    recommendation: str
    recommendation_id: int
    confidence: float
    data_completeness: float
    explanation: list[str]
    factors: list[FitnessFactor]
    alternative: FitnessAlternative
    next_step: str
    insight: dict
    window_start: date
    window_end: date
    cached: bool = False
