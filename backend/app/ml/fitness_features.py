"""
Feature schema for the fitness recommendation model.

Both `ml/train_fitness_model.py` and the API import from here, so the column
order can never drift between training and inference.

Why a seven-day window
----------------------
The diet model looks at a single day. Fitness cannot: the WHO physical
activity guidelines are expressed per week, and one rest day is not a
problem. Judging a single day would tell someone who trained hard yesterday
that they are sedentary today. Every activity feature below is therefore
aggregated over the seven days ending on the requested date.
"""

# Order matters: the model expects features in exactly this sequence.
FEATURE_NAMES = [
    "weekly_mvpa_minutes",
    "weekly_vigorous_minutes",
    "active_days",
    "strength_sessions",
    "avg_daily_steps",
    "avg_sleep_hours",
    "sleep_variability",
    "age",
    "bmi",
]

FEATURE_LABELS = {
    "weekly_mvpa_minutes": "weekly moderate-to-vigorous activity",
    "weekly_vigorous_minutes": "weekly vigorous activity",
    "active_days": "number of active days",
    "strength_sessions": "muscle-strengthening sessions",
    "avg_daily_steps": "average daily steps",
    "avg_sleep_hours": "average sleep",
    "sleep_variability": "night-to-night sleep variation",
    "age": "age",
    "bmi": "BMI",
}

FEATURE_UNITS = {
    "weekly_mvpa_minutes": "min",
    "weekly_vigorous_minutes": "min",
    "active_days": "days",
    "strength_sessions": "sessions",
    "avg_daily_steps": "steps",
    "avg_sleep_hours": "h",
    "sleep_variability": "h",
    "age": "years",
    "bmi": "",
}

CLASS_LABELS = {
    0: "On track — keep it up",
    1: "Build up your weekly activity",
    2: "Add muscle-strengthening sessions",
    3: "Prioritise rest and recovery",
    4: "Improve your sleep",
}

# Published reference points, used both to label the training data and to
# phrase explanations ("below the WHO recommendation of 150 minutes") rather
# than comparing users against an arbitrary population median.
#
#   WHO Guidelines on Physical Activity and Sedentary Behaviour (2020), adults:
#     - at least 150 min of moderate-intensity activity a week, or
#       75 min of vigorous, or an equivalent combination
#     - muscle-strengthening activity on 2 or more days a week
#   Sleep: 7-9 hours a night for adults (National Sleep Foundation).
#   Sleep regularity has no agreed clinical cut-off; 1.5 hours of
#   night-to-night variation is used here as a working threshold and is
#   documented as such rather than presented as a guideline.
#
# Each entry is (threshold, comparison, source). The comparison says which
# side of the threshold is the healthy one.
GUIDELINES = {
    "weekly_mvpa_minutes": (150, "at_least", "WHO recommendation of 150 minutes"),
    "strength_sessions": (2, "at_least", "WHO recommendation of 2 sessions"),
    "avg_sleep_hours": (7, "at_least", "recommended minimum of 7 hours"),
    "sleep_variability": (1.5, "at_most", "consistent sleep schedule"),
}

# Features the user cannot change. They remain model inputs, since BMI and age
# genuinely bear on what's appropriate, and they are always reported in
# `factors`. But they are kept out of the plain-language explanation: telling
# someone their age "pointed towards" a recommendation explains nothing they
# can act on, and where the model has learned an indirect correlation through
# them, it reads as nonsense.
NON_ACTIONABLE = {"age", "bmi"}

# Steps have no WHO threshold. Comparing against one would mean inventing a
# guideline — the popular 10,000-step figure originated as a marketing slogan
# rather than a clinical recommendation — so steps are compared against the
# typical value instead, like features with no published reference.

# Intensity values sent by the app, mapped to the categories the guidelines
# use. The app offers Easy / Moderate / Intense; older records may use the
# guideline vocabulary directly.
INTENSITY_MAP = {
    "easy": "light",
    "light": "light",
    "moderate": "moderate",
    "intense": "vigorous",
    "vigorous": "vigorous",
    "hard": "vigorous",
}

# WHO counts one minute of vigorous activity as equivalent to two minutes of
# moderate. Light activity does not count towards the guideline at all,
# though it still counts as an active day.
MVPA_WEIGHT = {"light": 0.0, "moderate": 1.0, "vigorous": 2.0}

# An activity with no intensity recorded is counted as moderate. This is the
# conservative middle: counting it as vigorous would overstate activity, and
# counting it as light would ignore it entirely.
DEFAULT_INTENSITY = "moderate"

# The direct causes of each recommendation, and which direction is the
# problem. A factor in this table, pushing the problematic way, is a reason
# for the advice. Any other factor that supported the prediction did so by
# ruling an alternative out — and is phrased that way, rather than implying
# that (say) a high step count is a reason to lift weights.
CLASS_DRIVERS = {
    1: {  # Build up your weekly activity
        "weekly_mvpa_minutes": "low",
        "active_days": "low",
        "weekly_vigorous_minutes": "low",
        "avg_daily_steps": "low",
    },
    2: {"strength_sessions": "low"},  # Add muscle-strengthening sessions
    3: {  # Prioritise rest and recovery
        "weekly_vigorous_minutes": "high",
        "avg_sleep_hours": "low",
    },
    4: {  # Improve your sleep
        "avg_sleep_hours": "low",
        "sleep_variability": "high",
    },
}

MODEL_VERSION = "fitness-1.0"
