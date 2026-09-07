from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    """One day's aggregated intake for a user, plus basic profile data."""

    fiber_g: float = Field(ge=0, le=200, examples=[9])
    sugar_g: float = Field(ge=0, le=500, examples=[40])
    sodium_mg: float = Field(ge=0, le=20000, examples=[2200])
    saturated_fat_g: float = Field(ge=0, le=200, examples=[15])
    protein_g: float = Field(ge=0, le=400, examples=[70])
    calories: float = Field(ge=0, le=10000, examples=[2100])
    vegetable_servings: float = Field(ge=0, le=30, examples=[1])
    water_ml: float = Field(ge=0, le=10000, examples=[1800])
    age: float = Field(ge=13, le=120, examples=[22])
    bmi: float = Field(ge=10, le=70, examples=[23.5])


class Factor(BaseModel):
    feature: str
    label: str
    value: float
    contribution: float
    direction: str


class Alternative(BaseModel):
    recommendation: str
    confidence: float


class RecommendationResponse(BaseModel):
    recommendation: str
    recommendation_id: int
    confidence: float
    explanation: list[str]
    factors: list[Factor]
    alternative: Alternative
