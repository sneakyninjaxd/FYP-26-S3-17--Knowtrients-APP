"""
Loads the trained model and turns a prediction into a recommendation
plus a SHAP-based explanation.

The model and explainer are loaded once at import time — loading them per
request would add seconds of latency to every call.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd

from .features import FEATURE_NAMES, FEATURE_LABELS, FEATURE_UNITS, CLASS_LABELS

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

_model = None
_explainer = None
_medians = None


def _load() -> None:
    """Lazily loads artifacts on first use, then caches them."""
    global _model, _explainer, _medians
    if _model is not None:
        return
    _model = joblib.load(os.path.join(ARTIFACT_DIR, "model.joblib"))
    _explainer = joblib.load(os.path.join(ARTIFACT_DIR, "explainer.joblib"))
    with open(os.path.join(ARTIFACT_DIR, "feature_medians.json")) as f:
        _medians = json.load(f)


def _phrase_contribution(feature: str, value: float, shap_value: float) -> str:
    """Turns one feature's SHAP contribution into a readable sentence."""
    label = FEATURE_LABELS[feature]
    unit = FEATURE_UNITS[feature]
    median = _medians[feature]

    direction = "higher" if value > median else "lower"
    unit_suffix = f" {unit}" if unit else ""
    formatted = f"{value:g}{unit_suffix}"
    formatted_median = f"{round(median, 1):g}{unit_suffix}"

    if shap_value > 0:
        effect = "pushed the recommendation towards this suggestion"
    else:
        effect = "pushed the recommendation away from this suggestion"

    return (
        f"Your {label} of {formatted} is {direction} than typical "
        f"(around {formatted_median}), which {effect}."
    )


def recommend(features: dict) -> dict:
    """
    Runs the model on one user's intake data and returns the recommendation
    together with its SHAP explanation.

    `features` must contain every key in FEATURE_NAMES.
    """
    _load()

    missing = [f for f in FEATURE_NAMES if f not in features]
    if missing:
        raise ValueError(f"Missing required features: {missing}")

    row = pd.DataFrame([[float(features[f]) for f in FEATURE_NAMES]], columns=FEATURE_NAMES)

    probabilities = _model.predict_proba(row)[0]
    predicted_class = int(np.argmax(probabilities))
    confidence = float(probabilities[predicted_class])

    # For multiclass, SHAP returns shape (n_samples, n_features, n_classes).
    shap_values = _explainer.shap_values(row)
    contributions = np.asarray(shap_values)[0, :, predicted_class]

    # Rank features by absolute impact — the biggest drivers first.
    order = np.argsort(np.abs(contributions))[::-1]

    factors = []
    for idx in order:
        feature = FEATURE_NAMES[idx]
        factors.append(
            {
                "feature": feature,
                "label": FEATURE_LABELS[feature],
                "value": float(row.iloc[0, idx]),
                "contribution": round(float(contributions[idx]), 4),
                "direction": "increases" if contributions[idx] > 0 else "decreases",
            }
        )

    top = [f for f in factors if abs(f["contribution"]) > 0.01][:3]
    explanation = [
        _phrase_contribution(f["feature"], f["value"], f["contribution"]) for f in top
    ]

    # Runner-up class, used for the "why this, not that" comparison view.
    alternative_class = int(np.argsort(probabilities)[-2])

    return {
        "recommendation": CLASS_LABELS[predicted_class],
        "recommendation_id": predicted_class,
        "confidence": round(confidence, 4),
        "explanation": explanation,
        "factors": factors,
        "alternative": {
            "recommendation": CLASS_LABELS[alternative_class],
            "confidence": round(float(probabilities[alternative_class]), 4),
        },
    }
