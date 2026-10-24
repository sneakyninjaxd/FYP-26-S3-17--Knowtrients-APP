"""
Turns a week of activity and sleep data into a fitness recommendation, with a
SHAP explanation and an insight card for the app's Insights screen.

Mirrors app/ml/recommender.py (the diet model), with three deliberate
differences.

1. Only supporting factors are explained in prose.
   A SHAP value is signed: positive pushes towards the predicted class,
   negative pushes away. The diet model phrases every top factor as having
   pushed "towards" or "away from" the suggestion, which is faithful to the
   maths but can read as nonsense — low sugar intake reported as a reason to
   eat more fibre. Here, the sentences describe only factors that pushed
   towards the result. Every factor, with its signed contribution, is still
   returned in `factors` for anyone who wants the full picture.

2. Explanations cite guidelines, not population medians.
   "Below the WHO recommendation of 150 minutes" is meaningful to a user;
   "lower than typical" is not, and "typical" here would mean "typical of
   the synthetic training data". Features without a published threshold
   fall back to the typical value, and say so.

3. Data completeness is reported separately from confidence.
   The model's confidence is its probability for the predicted class. It
   says nothing about how much data went in: a week with one logged walk
   can produce a confident prediction. `data_completeness` measures the
   share of the week that was logged, and both are returned so neither can
   masquerade as the other.
"""

import json
import os

import joblib
import numpy as np
import pandas as pd

from .fitness_features import (
    CLASS_LABELS,
    FEATURE_LABELS,
    FEATURE_NAMES,
    FEATURE_UNITS,
    GUIDELINES,
    CLASS_DRIVERS,
    MODEL_VERSION,
    NON_ACTIONABLE,
)

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

_model = None
_explainer = None
_medians = None

# A week logged less than this fully gets a caveat on the insight card.
LOW_COMPLETENESS = 0.5


def _load() -> None:
    """Loads artifacts on first use, then caches them for later requests."""
    global _model, _explainer, _medians
    if _model is not None:
        return
    _model = joblib.load(os.path.join(ARTIFACT_DIR, "fitness_model.joblib"))
    _explainer = joblib.load(os.path.join(ARTIFACT_DIR, "fitness_explainer.joblib"))
    with open(os.path.join(ARTIFACT_DIR, "fitness_feature_medians.json")) as f:
        _medians = json.load(f)


def is_available() -> bool:
    """True when the model artefacts exist, so callers can fail cleanly."""
    try:
        _load()
        return True
    except FileNotFoundError:
        return False


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------


def _fmt(feature: str, value: float) -> str:
    """Renders a feature value with its unit, sensibly rounded."""
    unit = FEATURE_UNITS[feature]

    # Singular units read better for a count of one.
    if unit in ("sessions", "days") and round(value) == 1:
        unit = unit[:-1]

    if feature == "avg_daily_steps":
        text = f"{round(value):,}"
    elif feature in ("avg_sleep_hours", "sleep_variability", "bmi"):
        text = f"{value:.1f}"
    else:
        text = f"{round(value):g}"

    return f"{text} {unit}".strip()


def _compare(feature: str, value: float) -> str:
    """
    Describes where a value sits relative to its reference point.

    Uses the published guideline where one exists, and the typical value
    otherwise — saying which, so the user knows what they're compared with.
    """
    if feature in GUIDELINES:
        threshold, rule, source = GUIDELINES[feature]
        meets = value >= threshold if rule == "at_least" else value <= threshold

        if rule == "at_least":
            position = "meets" if meets else "is below"
        else:
            position = "is within" if meets else "is outside"

        return f"{position} the {source}"

    median = _medians[feature]
    if abs(value - median) < 1e-9:
        return "is about typical"
    position = "above" if value > median else "below"
    return f"is {position} the typical {_fmt(feature, median)}"


def _meets_guideline(feature: str, value: float) -> bool | None:
    """True/False against the guideline, or None if there isn't one."""
    if feature not in GUIDELINES:
        return None
    threshold, rule, _ = GUIDELINES[feature]
    return value >= threshold if rule == "at_least" else value <= threshold


def _reference(feature: str) -> float:
    """The guideline threshold where there is one, otherwise the typical value."""
    if feature in GUIDELINES:
        return GUIDELINES[feature][0]
    return _medians[feature]


def _is_direct_driver(feature: str, value: float, predicted: int) -> bool:
    """
    True when this factor is a direct reason for the recommendation: it is
    one of the recommendation's declared causes, pushing the problematic way.
    """
    direction = CLASS_DRIVERS.get(predicted, {}).get(feature)
    if direction is None:
        return False
    reference = _reference(feature)
    return value < reference if direction == "low" else value > reference


def _phrase(feature: str, value: float, imputed: bool, predicted: int) -> str:
    """
    One readable sentence about a factor that supported the result.

    A supporting factor works in one of two ways, and they need different
    wording:

    - A direct driver points straight at the advice. Low activity supports
      "build up your activity".
    - Anything else supports it by elimination. Good sleep rules out
      "improve your sleep", which makes the remaining recommendations more
      likely. Saying it "pointed towards" building activity would imply the
      good sleep is itself a reason to exercise more.
    """
    label = FEATURE_LABELS[feature]

    if imputed:
        return (
            f"No {label} were synced from your device, so a typical value was "
            f"assumed. Connecting Health Connect would make this more accurate."
        )

    value_text = _fmt(feature, value)
    comparison = _compare(feature, value)

    if predicted == 0:
        return f"Your {label} of {value_text} {comparison}."

    if _is_direct_driver(feature, value, predicted):
        return (
            f"Your {label} of {value_text} {comparison}, which pointed towards "
            f"this recommendation."
        )

    return (
        f"Your {label} of {value_text} {comparison}, so it isn't the priority "
        f"right now."
    )


# ---------------------------------------------------------------------------
# Personalised next step
# ---------------------------------------------------------------------------


def _next_step(predicted: int, features: dict) -> str:
    """
    A concrete, sized action for the predicted class.

    Sized from the user's own numbers ("add 70 more minutes") rather than
    restating the guideline, so the advice is something they can act on.
    """
    mvpa = features["weekly_mvpa_minutes"]
    strength = features["strength_sessions"]
    sleep = features["avg_sleep_hours"]
    variability = features["sleep_variability"]
    vigorous = features["weekly_vigorous_minutes"]

    if predicted == 1:
        gap = max(0, 150 - mvpa)
        per_day = max(10, round(gap / 5 / 5) * 5)
        return (
            f"Add about {round(gap)} more minutes of moderate activity this week — "
            f"roughly {per_day} minutes on five days, such as a brisk walk after lunch."
        )

    if predicted == 2:
        needed = max(1, int(2 - strength))
        session = "session" if needed == 1 else "sessions"
        return (
            f"Add {needed} muscle-strengthening {session} this week. Bodyweight "
            f"exercises like squats, push-ups and lunges count, no equipment needed."
        )

    if predicted == 3:
        return (
            f"You logged {round(vigorous)} minutes of vigorous activity on an "
            f"average of {sleep:.1f} hours of sleep. Swap one hard session for an "
            f"easy one and aim for at least 7 hours tonight."
        )

    if predicted == 4:
        if sleep < 7:
            short = 7 - sleep
            minutes = max(15, round(short * 60 / 15) * 15)
            return (
                f"Aim to get to bed about {minutes} minutes earlier to reach "
                f"7 hours a night."
            )
        return (
            f"Your sleep varies by about {variability:.1f} hours night to night. "
            f"Keeping a consistent bedtime, even at weekends, would help most."
        )

    return (
        "You're meeting the WHO activity and strength guidelines and sleeping "
        "well. Keep your current routine."
    )


# ---------------------------------------------------------------------------
# Insight card
# ---------------------------------------------------------------------------


def _observations(features: dict, imputed: set) -> list[dict]:
    """
    Guideline checks shown as the card's bullet points.

    Built from the guidelines directly rather than from SHAP, so the card
    reports plain facts about the week independently of the model.
    """
    out = []

    mvpa = features["weekly_mvpa_minutes"]
    if mvpa >= 150:
        out.append({"icon": "check", "text": f"Activity goal met ({round(mvpa)} min)"})
    else:
        out.append(
            {"icon": "warning", "text": f"Activity below goal ({round(mvpa)}/150 min)"}
        )

    strength = features["strength_sessions"]
    if strength >= 2:
        out.append({"icon": "check", "text": f"{int(strength)} strength sessions"})
    else:
        out.append(
            {"icon": "warning", "text": f"{int(strength)}/2 strength sessions"}
        )

    sleep = features["avg_sleep_hours"]
    if sleep < 6.5:
        out.append({"icon": "alert", "text": f"Short sleep ({sleep:.1f}h average)"})
    elif sleep < 7:
        out.append({"icon": "warning", "text": f"Sleep slightly short ({sleep:.1f}h)"})
    else:
        out.append({"icon": "check", "text": f"Sleep on target ({sleep:.1f}h)"})

    if "avg_daily_steps" in imputed:
        out.append({"icon": "info", "text": "Steps not synced from device"})

    return out


def _build_insight(
    predicted: int,
    confidence: float,
    features: dict,
    factors: list[dict],
    explanation: list[str],
    imputed: set,
    completeness: float,
    window: tuple[str, str],
) -> dict:
    """
    Shapes the result like an entry in the app's src/insights.js, so the
    Insights screen can replace its hardcoded Activity card with this.
    """
    start, end = window

    reasoning_technical = [
        "Aggregated activity, step and sleep logs over the 7 days ending "
        f"{end}.",
        f"Computed moderate-equivalent activity as moderate + 2 × vigorous "
        f"minutes = {round(features['weekly_mvpa_minutes'])} min.",
        f"XGBoost predicted '{CLASS_LABELS[predicted]}' with probability "
        f"{confidence:.2f}.",
    ] + [
        f"SHAP: {f['label']} = {_fmt(f['feature'], f['value'])}, "
        f"contribution {f['contribution']:+.3f}"
        + (" (assumed typical value)" if f.get("imputed") else "")
        for f in factors[:4]
    ]

    data_used = [f"Activity and sleep logs {start} to {end}"]
    if "avg_daily_steps" not in imputed:
        data_used.append("Step counts synced from your device")
    data_used.append("Age and BMI from your profile")

    footer = ""
    if completeness < LOW_COMPLETENESS:
        footer = (
            f"Only {round(completeness * 100)}% of this week was logged, so this "
            f"recommendation is based on limited data."
        )

    return {
        "id": "activity",
        "aspect": "Activity Aspect",
        # Capped at 99 for display. A probability of 0.995 rounds to 100, and
        # showing "100% confident" claims a certainty no probabilistic model
        # has. The unrounded value is still returned as `confidence`.
        "confidence": min(99, round(confidence * 100)),
        "data_completeness": round(completeness * 100),
        "observations": _observations(features, imputed),
        "title": CLASS_LABELS[predicted],
        "summary": _next_step(predicted, features),
        "observation": (
            f"Weekly activity: {round(features['weekly_mvpa_minutes'])} min · "
            f"Sleep: {features['avg_sleep_hours']:.1f}h average"
        ),
        "dataUsed": data_used,
        "reasoningSimple": explanation,
        "reasoningTechnical": reasoning_technical,
        "recommendation": _next_step(predicted, features),
        "footer": footer,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def recommend(
    features: dict,
    imputed: set | None = None,
    completeness: float = 1.0,
    window: tuple[str, str] = ("", ""),
) -> dict:
    """
    Predicts a fitness recommendation and explains it.

    `features` must contain every key in FEATURE_NAMES. `imputed` names any
    feature filled with a typical value because the user had no data for it.
    """
    _load()
    imputed = imputed or set()

    missing = [f for f in FEATURE_NAMES if f not in features]
    if missing:
        raise ValueError(f"Missing required features: {missing}")

    row = pd.DataFrame(
        [[float(features[f]) for f in FEATURE_NAMES]], columns=FEATURE_NAMES
    )

    probabilities = _model.predict_proba(row)[0]
    predicted = int(np.argmax(probabilities))
    confidence = float(probabilities[predicted])

    shap_values = _explainer.shap_values(row)
    contributions = np.asarray(shap_values)[0, :, predicted]

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
                "imputed": feature in imputed,
            }
        )

    # Explain only actionable factors that pushed towards this result.
    # Shortfalls are listed first: they are the direct reason for the advice,
    # while met guidelines support it only by ruling alternatives out.
    supporting = [
        f for f in factors
        if f["contribution"] > 0.01 and f["feature"] not in NON_ACTIONABLE
    ]
    # Direct drivers first, then at most one factor that helped by
    # elimination — enough to show what was ruled out without crowding out
    # the actual reasons.
    drivers = [
        f for f in supporting
        if _is_direct_driver(f["feature"], f["value"], predicted)
    ]
    others = [f for f in supporting if f not in drivers]
    if predicted == 0:
        chosen = supporting[:3]
    else:
        chosen = drivers[:2] + others[: 3 - len(drivers[:2])][:1]
        if not drivers:
            chosen = others[:2]

    explanation = [
        _phrase(f["feature"], f["value"], f["imputed"], predicted) for f in chosen
    ]
    if not explanation:
        explanation = [
            "No single habit stood out; this recommendation reflects your week "
            "as a whole."
        ]

    runner_up = int(np.argsort(probabilities)[-2])

    return {
        "recommendation": CLASS_LABELS[predicted],
        "recommendation_id": predicted,
        "confidence": round(confidence, 4),
        "data_completeness": round(completeness, 4),
        "explanation": explanation,
        "factors": factors,
        "alternative": {
            "recommendation": CLASS_LABELS[runner_up],
            "confidence": round(float(probabilities[runner_up]), 4),
        },
        "next_step": _next_step(predicted, features),
        "insight": _build_insight(
            predicted,
            confidence,
            features,
            factors,
            explanation,
            imputed,
            completeness,
            window,
        ),
        "model_version": MODEL_VERSION,
    }
