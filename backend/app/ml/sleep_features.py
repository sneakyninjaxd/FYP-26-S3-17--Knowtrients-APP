"""
Feature schema for the sleep recommendation model.

Both `ml/train_sleep_model.py` and the API import from here, so the column
order can never drift between training and inference.

Like the fitness model, this looks at a seven-night window: one late night
isn't a pattern, and sleep regularity can only be measured across several
nights.

What the app records
--------------------
Every sleep entry from the app carries a bedtime and a wake time (24-hour
"HH:MM"), so timing features are reliable. The app does not ask for sleep
quality, so the `quality` column is not used — it would almost always be
empty. Subjective quality comes from sleep satisfaction check-ins instead.
"""

FEATURE_NAMES = [
    "avg_sleep_hours",
    "short_nights",
    "duration_variability",
    "bedtime_variability",
    "wake_variability",
    "avg_bedtime",
    "satisfaction_rate",
    "weekly_activity_minutes",
    "age",
]

FEATURE_LABELS = {
    "avg_sleep_hours": "average sleep",
    "short_nights": "nights under 6 hours",
    "duration_variability": "night-to-night variation in sleep length",
    "bedtime_variability": "bedtime variation",
    "wake_variability": "wake-up time variation",
    "avg_bedtime": "average bedtime",
    "satisfaction_rate": "share of nights you rated as satisfying",
    "weekly_activity_minutes": "weekly moderate-to-vigorous activity",
    "age": "age",
}

CLASS_LABELS = {
    0: "Sleep is on track — keep it up",
    1: "Aim for 7–9 hours a night",
    2: "Keep a more regular sleep schedule",
    3: "Improve how restful your sleep is",
}

# Reference points.
#
#   Duration: 7-9 hours a night for adults (National Sleep Foundation;
#   American Academy of Sleep Medicine recommends at least 7). Both
#   directions matter: regularly sleeping much more than 9 hours can also
#   indicate sleep that isn't restful.
#
#   Regularity: research on sleep regularity links irregular timing to worse
#   outcomes, but there is no agreed clinical cut-off. A standard deviation
#   of 60 minutes in bed or wake time is used as a working threshold, and
#   1.5 hours for duration (matching the fitness model). These are
#   documented as working values, not guidelines.
#
# Each entry is (threshold, comparison, description). "range" takes a
# (low, high) tuple.
GUIDELINES = {
    "avg_sleep_hours": ((7, 9), "range", "recommended 7–9 hours"),
    "bedtime_variability": (60, "at_most", "regular schedule (about an hour either way)"),
    "wake_variability": (60, "at_most", "regular schedule (about an hour either way)"),
    "duration_variability": (1.5, "at_most", "consistent sleep length"),
}

SHORT_NIGHT_HOURS = 6.0
LOW_SATISFACTION = 0.5

# The direct causes of each recommendation, and which direction is the
# problem. "outside" means outside the guideline range in either direction.
# Any other factor that supported a prediction did so by ruling an
# alternative out, and is worded that way — see the fitness model for the
# reasoning.
CLASS_DRIVERS = {
    1: {
        "avg_sleep_hours": "outside",
        "short_nights": "high",
        "avg_bedtime": "high",
    },
    2: {
        "bedtime_variability": "high",
        "wake_variability": "high",
        "duration_variability": "high",
    },
    3: {
        "satisfaction_rate": "low",
        # Regular daytime activity is associated with deeper sleep, so low
        # activity is a direct reason for advice about restfulness.
        "weekly_activity_minutes": "low",
    },
}

# Features the user can't change. Model inputs, reported in `factors`, but
# never presented as a reason in the explanation.
NON_ACTIONABLE = {"age"}

MODEL_VERSION = "sleep-1.0"


def bedtime_to_minutes(value: str | None) -> float | None:
    """
    Converts an "HH:MM" bedtime to minutes relative to midnight.

    Bedtimes straddle midnight, so ordinary clock minutes don't average:
    23:30 and 00:30 average to midday. Times from noon onwards are treated
    as the evening before (negative), and times before noon as after
    midnight (positive). So 23:30 is -30, 00:45 is +45, 21:00 is -180.

    This assumes a conventional night-time sleeper. A night-shift worker who
    sleeps from 08:00 would be read as going to bed very late — a known
    limitation, documented in the README.
    """
    if not value:
        return None
    try:
        hours, minutes = value.strip().split(":")[:2]
        total = int(hours) * 60 + int(minutes)
    except (ValueError, AttributeError):
        return None
    if not 0 <= total < 1440:
        return None
    return float(total - 1440 if total >= 720 else total)


def wake_to_minutes(value: str | None) -> float | None:
    """Converts an "HH:MM" wake time to minutes after midnight."""
    if not value:
        return None
    try:
        hours, minutes = value.strip().split(":")[:2]
        total = int(hours) * 60 + int(minutes)
    except (ValueError, AttributeError):
        return None
    return float(total) if 0 <= total < 1440 else None


def minutes_to_clock(relative: float) -> str:
    """Renders minutes-relative-to-midnight as a 12-hour clock time."""
    total = int(round(relative)) % 1440
    hours, minutes = divmod(total, 60)
    suffix = "am" if hours < 12 else "pm"
    display = hours % 12 or 12
    return f"{display}:{minutes:02d} {suffix}"
