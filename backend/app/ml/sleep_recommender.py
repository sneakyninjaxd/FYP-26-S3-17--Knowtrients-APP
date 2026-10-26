"""
Turns a week of sleep into a recommendation, with a SHAP explanation and an
insight card for the app's Insights screen.

Follows app/ml/fitness_recommender.py — explanations describe only factors
that supported the result, distinguish direct causes from factors that
helped by ruling an alternative out, cite guidelines rather than population
medians, and report data completeness separately from confidence. See that
module for the reasoning behind each.

Two additions specific to sleep:

- Duration is checked against a range. Sleeping too long is flagged as well
  as sleeping too little, because a model that only caught short sleep would
  call eleven hours a night "on track".

- Advice that touches on health says so. Persistently long or unrestful
  sleep can have causes no app should guess at, so those recommendations
  suggest speaking to a doctor rather than implying the app can resolve it
  (constraint C-07: wellness guidance, not medical advice).
"""

import json
import os

import joblib
import numpy as np
import pandas as pd

from .sleep_features import (
    CLASS_DRIVERS,
    CLASS_LABELS,
    FEATURE_LABELS,
    FEATURE_NAMES,
    GUIDELINES,
    MODEL_VERSION,
    NON_ACTIONABLE,
    minutes_to_clock,
)

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

_model = None
_explainer = None
_medians = None

LOW_COMPLETENESS = 0.5


def _load() -> None:
    global _model, _explainer, _medians
    if _model is not None:
        return
    _model = joblib.load(os.path.join(ARTIFACT_DIR, "sleep_model.joblib"))
    _explainer = joblib.load(os.path.join(ARTIFACT_DIR, "sleep_explainer.joblib"))
    with open(os.path.join(ARTIFACT_DIR, "sleep_feature_medians.json")) as f:
        _medians = json.load(f)


def is_available() -> bool:
    try:
        _load()
        return True
    except FileNotFoundError:
        return False


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------


def _fmt(feature: str, value: float) -> str:
    """Renders a value the way a person would say it."""
    if feature == "avg_bedtime":
        return minutes_to_clock(value)
    if feature in ("bedtime_variability", "wake_variability"):
        return f"±{round(value)} min"
    if feature == "satisfaction_rate":
        return f"{round(value * 100)}%"
    if feature in ("avg_sleep_hours", "duration_variability"):
        return f"{value:.1f} h"
    if feature == "short_nights":
        n = round(value)
        return f"{n} night" if n == 1 else f"{n} nights"
    if feature == "weekly_activity_minutes":
        return f"{round(value)} min"
    return f"{round(value):g}"


def _guideline_state(feature: str, value: float) -> str | None:
    """'within', 'below', 'above' (for ranges) / 'meets', 'fails'; None if no guideline."""
    if feature not in GUIDELINES:
        return None
    threshold, rule, _ = GUIDELINES[feature]
    if rule == "range":
        low, high = threshold
        if value < low:
            return "below"
        if value > high:
            return "above"
        return "within"
    if rule == "at_least":
        return "meets" if value >= threshold else "fails"
    return "meets" if value <= threshold else "fails"


def _compare(feature: str, value: float) -> str:
    """Where a value sits relative to its reference, saying which reference."""
    state = _guideline_state(feature, value)
    if state is not None:
        _, rule, source = GUIDELINES[feature]
        if rule == "range":
            return {
                "below": f"is below the {source}",
                "above": f"is above the {source}",
                "within": f"is within the {source}",
            }[state]
        if rule == "at_most":
            return f"is within a {source}" if state == "meets" else f"is outside a {source}"
        return f"meets the {source}" if state == "meets" else f"is below the {source}"

    median = _medians[feature]
    if abs(value - median) < 1e-9:
        return "is about typical"
    position = "later than" if feature == "avg_bedtime" else (
        "above" if value > median else "below"
    )
    if feature == "avg_bedtime" and value < median:
        position = "earlier than"
    return f"is {position} the typical {_fmt(feature, median)}"


def _reference(feature: str):
    if feature in GUIDELINES:
        return GUIDELINES[feature][0]
    return _medians[feature]


def _is_direct_driver(feature: str, value: float, predicted: int) -> bool:
    """True when this factor is one of the recommendation's direct causes."""
    direction = CLASS_DRIVERS.get(predicted, {}).get(feature)
    if direction is None:
        return False
    if direction == "outside":
        return _guideline_state(feature, value) in ("below", "above")
    if feature == "satisfaction_rate":
        return value < 0.5
    reference = _reference(feature)
    if isinstance(reference, tuple):
        return False
    return value < reference if direction == "low" else value > reference


def _phrase(feature: str, value: float, imputed: bool, predicted: int) -> str:
    label = FEATURE_LABELS[feature]

    if imputed:
        if feature == "satisfaction_rate":
            return (
                "You haven't rated how satisfied you were with your sleep this "
                "week, so a typical value was assumed. Rating your nights makes "
                "this more accurate."
            )
        if feature in ("bedtime_variability", "wake_variability", "avg_bedtime"):
            return (
                f"Not enough nights had bed and wake times to measure your "
                f"{label}, so a typical value was assumed."
            )
        return f"Not enough data for your {label}, so a typical value was assumed."

    if feature == "satisfaction_rate":
        share = f"You rated {_fmt(feature, value)} of this week's nights as satisfying"
        if value < 0.5:
            tail = (
                "which pointed towards this recommendation"
                if _is_direct_driver(feature, value, predicted)
                else "though that isn't the priority right now"
            )
            return f"{share} — fewer than half, {tail}."
        return f"{share}."

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


def _round_quarter(minutes: float) -> int:
    """
    Rounds up to the next quarter hour. Rounding to nearest would sometimes
    fall short: someone averaging 5.9 hours told "60 minutes earlier" still
    wouldn't reach 7.
    """
    import math
    return max(15, int(math.ceil(minutes / 15) * 15))


def _next_step(predicted: int, f: dict) -> str:
    hours = f["avg_sleep_hours"]
    bedtime = f["avg_bedtime"]

    if predicted == 1:
        if hours < 7:
            earlier = _round_quarter((7 - hours) * 60)
            target = minutes_to_clock(bedtime - earlier)
            return (
                f"You're averaging {hours:.1f} hours. Going to bed about "
                f"{earlier} minutes earlier — around {target} — would get you "
                f"to 7 hours."
            )
        return (
            f"You're averaging {hours:.1f} hours, more than the recommended 9. "
            f"Try keeping a fixed wake-up time every day. If you still wake up "
            f"tired despite long nights, it's worth mentioning to a doctor."
        )

    if predicted == 2:
        if f["wake_variability"] >= f["bedtime_variability"]:
            return (
                f"Your wake-up time varies by about "
                f"{_fmt('wake_variability', f['wake_variability'])}. Getting up "
                f"at the same time every day, weekends included, is the most "
                f"effective way to steady your sleep."
            )
        return (
            f"Your bedtime varies by about "
            f"{_fmt('bedtime_variability', f['bedtime_variability'])}. Pick a "
            f"target bedtime and keep within 30 minutes of it, weekends "
            f"included."
        )

    if predicted == 3:
        advice = (
            "Try a wind-down routine: no screens for 30–60 minutes before bed, "
            "and no caffeine after early afternoon."
        )
        if f["weekly_activity_minutes"] < 150:
            advice += " Regular daytime activity also helps you sleep more deeply."
        advice += (
            " If your sleep stays unrestful for several weeks, consider speaking "
            "to a doctor."
        )
        return advice

    return (
        "Your sleep is meeting the recommended duration on a regular "
        "schedule. Keep your current routine."
    )


# ---------------------------------------------------------------------------
# Insight card
# ---------------------------------------------------------------------------


def _observations(f: dict, imputed: set, nights_logged: int) -> list[dict]:
    """Plain guideline checks for the card's bullets, independent of the model."""
    out = []
    hours = f["avg_sleep_hours"]

    if hours < 6:
        out.append({"icon": "alert", "text": f"Short sleep ({hours:.1f}h average)"})
    elif hours < 7:
        out.append({"icon": "warning", "text": f"Slightly short ({hours:.1f}h average)"})
    elif hours > 9:
        out.append({"icon": "warning", "text": f"Long sleep ({hours:.1f}h average)"})
    else:
        out.append({"icon": "check", "text": f"Duration on target ({hours:.1f}h)"})

    if "bedtime_variability" not in imputed:
        spread = max(f["bedtime_variability"], f["wake_variability"])
        if spread > 60:
            out.append({"icon": "warning", "text": f"Irregular schedule (±{round(spread)} min)"})
        else:
            out.append({"icon": "check", "text": f"Regular schedule (±{round(spread)} min)"})

    short = int(f["short_nights"])
    if short:
        word = "night" if short == 1 else "nights"
        out.append({"icon": "warning", "text": f"{short} {word} under 6 hours"})

    if "satisfaction_rate" in imputed:
        out.append({"icon": "info", "text": "No sleep ratings this week"})
    elif f["satisfaction_rate"] < 0.5:
        out.append({"icon": "warning", "text": "Mostly unsatisfied with sleep"})

    out.append({"icon": "info", "text": f"{nights_logged} of 7 nights logged"})
    return out


def _build_insight(
    predicted, confidence, f, factors, explanation, imputed, completeness,
    window, nights_logged,
) -> dict:
    start, end = window

    technical = [
        f"Aggregated {nights_logged} logged nights over the 7 days ending {end}.",
        f"Average bedtime {minutes_to_clock(f['avg_bedtime'])}, bedtime spread "
        f"±{round(f['bedtime_variability'])} min, wake spread "
        f"±{round(f['wake_variability'])} min.",
        f"XGBoost predicted '{CLASS_LABELS[predicted]}' with probability {confidence:.2f}.",
    ] + [
        f"SHAP: {x['label']} = {_fmt(x['feature'], x['value'])}, contribution "
        f"{x['contribution']:+.3f}" + (" (assumed typical value)" if x.get("imputed") else "")
        for x in factors[:4]
    ]

    data_used = [f"Sleep logs {start} to {end}"]
    if "satisfaction_rate" not in imputed:
        data_used.append("Your sleep satisfaction ratings")
    data_used.append("Activity logs, for weekly activity")
    data_used.append("Age from your profile")

    footer = ""
    if completeness < LOW_COMPLETENESS:
        verb = "night was" if nights_logged == 1 else "nights were"
        footer = (
            f"Only {nights_logged} of 7 {verb} logged, so this "
            f"recommendation is based on limited data."
        )

    step = _next_step(predicted, f)
    return {
        "id": "sleep",
        "aspect": "Sleep Aspect",
        "confidence": min(99, round(confidence * 100)),
        "data_completeness": round(completeness * 100),
        "observations": _observations(f, imputed, nights_logged),
        "title": CLASS_LABELS[predicted],
        "summary": step,
        "observation": (
            f"Average sleep: {f['avg_sleep_hours']:.1f}h · "
            f"Average bedtime: {minutes_to_clock(f['avg_bedtime'])}"
        ),
        "dataUsed": data_used,
        "reasoningSimple": explanation,
        "reasoningTechnical": technical,
        "recommendation": step,
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
    nights_logged: int = 7,
) -> dict:
    _load()
    imputed = imputed or set()

    missing = [x for x in FEATURE_NAMES if x not in features]
    if missing:
        raise ValueError(f"Missing required features: {missing}")

    row = pd.DataFrame([[float(features[x]) for x in FEATURE_NAMES]], columns=FEATURE_NAMES)

    probabilities = _model.predict_proba(row)[0]
    predicted = int(np.argmax(probabilities))
    confidence = float(probabilities[predicted])

    contributions = np.asarray(_explainer.shap_values(row))[0, :, predicted]
    order = np.argsort(np.abs(contributions))[::-1]

    factors = []
    for idx in order:
        name = FEATURE_NAMES[idx]
        factors.append(
            {
                "feature": name,
                "label": FEATURE_LABELS[name],
                "value": float(row.iloc[0, idx]),
                "contribution": round(float(contributions[idx]), 4),
                "direction": "increases" if contributions[idx] > 0 else "decreases",
                "imputed": name in imputed,
            }
        )

    supporting = [
        x for x in factors
        if x["contribution"] > 0.01 and x["feature"] not in NON_ACTIONABLE
    ]
    drivers = [x for x in supporting if _is_direct_driver(x["feature"], x["value"], predicted)]
    others = [x for x in supporting if x not in drivers]

    if predicted == 0:
        chosen = supporting[:3]
    elif drivers:
        chosen = drivers[:2] + others[:1]
    else:
        chosen = others[:2]

    explanation = [
        _phrase(x["feature"], x["value"], x["imputed"], predicted) for x in chosen
    ] or ["No single habit stood out; this reflects your week of sleep as a whole."]

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
            predicted, confidence, features, factors, explanation, imputed,
            completeness, window, nights_logged,
        ),
        "model_version": MODEL_VERSION,
    }
