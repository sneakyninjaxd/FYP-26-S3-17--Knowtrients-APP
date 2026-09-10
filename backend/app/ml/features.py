"""
Single source of truth for the model's feature schema.

Both the training script and the API import from here, so the column order
can never drift between them — a classic cause of silently wrong predictions.
"""

# Order matters: the model expects features in exactly this sequence.
FEATURE_NAMES = [
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "saturated_fat_g",
    "protein_g",
    "calories",
    "vegetable_servings",
    "water_ml",
    "age",
    "bmi",
]

# Human-readable names used when turning SHAP output into plain language.
FEATURE_LABELS = {
    "fiber_g": "fibre intake",
    "sugar_g": "added sugar intake",
    "sodium_mg": "sodium intake",
    "saturated_fat_g": "saturated fat intake",
    "protein_g": "protein intake",
    "calories": "daily calorie intake",
    "vegetable_servings": "vegetable servings",
    "water_ml": "water intake",
    "age": "age",
    "bmi": "BMI",
}

# Which direction is "more" for each feature, used to phrase explanations
# ("higher than typical" vs "lower than typical").
FEATURE_UNITS = {
    "fiber_g": "g",
    "sugar_g": "g",
    "sodium_mg": "mg",
    "saturated_fat_g": "g",
    "protein_g": "g",
    "calories": "kcal",
    "vegetable_servings": "servings",
    "water_ml": "ml",
    "age": "years",
    "bmi": "",
}

# The recommendation classes the model predicts.
CLASS_LABELS = {
    0: "Balanced — keep it up",
    1: "Increase fibre and vegetables",
    2: "Reduce added sugar",
    3: "Reduce sodium and saturated fat",
}
