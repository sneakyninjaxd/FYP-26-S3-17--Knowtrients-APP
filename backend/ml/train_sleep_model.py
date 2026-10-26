"""
Trains the Knowtrients sleep recommendation model.

Run from the backend/ directory:
    python ml/train_sleep_model.py

Mirrors the diet and fitness models: an XGBoost multiclass classifier
explained with SHAP TreeExplainer, so attributions are exact (C-01).

WHERE THE LABELS COME FROM
--------------------------
As with the fitness model, no public dataset pairs a week of sleep with the
advice it should have produced, so labels are assigned by rule from
published guidance:

  - Duration: 7-9 hours a night for adults (National Sleep Foundation;
    the American Academy of Sleep Medicine recommends at least 7).
  - Regularity: irregular sleep timing is associated with worse outcomes.
    There is no clinical cut-off, so 60 minutes of bed- or wake-time
    variation is used as a working threshold, and documented as such.

In priority order, because a week can fail several at once and the user
should hear the most fundamental issue first:

  1. Duration outside 7-9 hours, in either direction.
  2. Irregular schedule.
  3. Duration and timing fine, but the user mostly rated their sleep as
     unsatisfying — a sign the sleep itself isn't restful.
  0. Otherwise on track.

The feature distributions are synthetic, with realistic correlations: later
bedtimes mean shorter sleep (most people's wake time is fixed by work),
irregular bedtimes go with irregular wake times and sleep length, and older
adults tend to go to bed earlier.

ACCURACY
--------
Test accuracy measures agreement with the labelling rules on held-out
synthetic data. It shows the pipeline works end to end; it is not evidence
of real-world effectiveness.
"""

import os
import sys

import joblib
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.ml.sleep_features import (  # noqa: E402
    CLASS_LABELS,
    FEATURE_NAMES,
    GUIDELINES,
    LOW_SATISFACTION,
    SHORT_NIGHT_HOURS,
)

RANDOM_SEED = 42
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "ml", "artifacts")

SLEEP_LOW, SLEEP_HIGH = GUIDELINES["avg_sleep_hours"][0]
TIMING_LIMIT = GUIDELINES["bedtime_variability"][0]
DURATION_LIMIT = GUIDELINES["duration_variability"][0]


def label_week(row: pd.Series) -> int:
    """Assigns one recommendation to a week of sleep, in priority order."""
    if row["avg_sleep_hours"] < SLEEP_LOW or row["avg_sleep_hours"] > SLEEP_HIGH:
        return 1
    if (
        row["bedtime_variability"] > TIMING_LIMIT
        or row["wake_variability"] > TIMING_LIMIT
        or row["duration_variability"] > DURATION_LIMIT
    ):
        return 2
    if row["satisfaction_rate"] < LOW_SATISFACTION:
        return 3
    return 0


def build_dataset(n_samples: int = 6000) -> tuple[pd.DataFrame, pd.Series]:
    rng = np.random.default_rng(RANDOM_SEED)

    age = rng.integers(18, 76, n_samples).astype(float)

    # Chronotype: average bedtime in minutes relative to midnight. Older
    # adults tend to go to bed earlier.
    avg_bedtime = rng.normal(-20, 55, n_samples) - np.clip(age - 40, 0, None) * 0.8
    avg_bedtime = avg_bedtime.clip(-240, 240)

    # Latent regularity, 0 (chaotic) to 1 (clockwork).
    regularity = rng.beta(2.2, 2.0, n_samples)

    bedtime_var = (15 + (1 - regularity) * 110 + rng.normal(0, 14, n_samples)).clip(5, 240)
    # Irregular bedtimes usually come with irregular wake times — the
    # weekend lie-in is the classic case — but not perfectly.
    wake_var = (0.6 * bedtime_var + rng.normal(12, 16, n_samples)).clip(5, 240)

    # Later bedtimes mean shorter sleep, because most people's wake time is
    # fixed by work or school.
    hours = (
        7.6
        - np.clip(avg_bedtime, 0, None) / 60 * 0.55
        - (age > 60) * 0.3
        + rng.normal(0, 0.75, n_samples)
    )
    # A minority of long sleepers, so the "too much sleep" side of the
    # duration guideline exists in the data and is learned.
    long_sleeper = rng.random(n_samples) < 0.07
    hours = np.where(long_sleeper, rng.uniform(9.2, 10.8, n_samples), hours)
    hours = hours.clip(3.5, 11.5)

    duration_var = (0.3 + (1 - regularity) * 1.5 + rng.gamma(1.5, 0.18, n_samples)).clip(0, 4)

    # Short nights rise as the average falls and as nights get more erratic.
    short_rate = 1 / (1 + np.exp(-(SHORT_NIGHT_HOURS + 0.6 - hours) * 1.6 - duration_var * 0.5 + 1.0))
    short_nights = rng.binomial(7, short_rate.clip(0, 1)).astype(float)

    activity = rng.gamma(2.0, 75, n_samples).clip(0, 600)

    # Satisfaction is higher with enough, regular sleep and some activity.
    # A minority report poor sleep despite fine duration and timing — the
    # case the "restful" recommendation exists for.
    in_range = ((hours >= SLEEP_LOW) & (hours <= SLEEP_HIGH)).astype(float)
    satisfaction = (
        0.42
        + 0.18 * in_range
        + 0.20 * regularity
        + 0.0004 * activity
        - 0.04 * short_nights
        + rng.normal(0, 0.12, n_samples)
    )
    restless = rng.random(n_samples) < 0.12
    satisfaction = np.where(restless, rng.uniform(0.0, 0.45, n_samples), satisfaction)
    satisfaction = satisfaction.clip(0, 1)

    df = pd.DataFrame(
        {
            "avg_sleep_hours": hours.round(2),
            "short_nights": short_nights,
            "duration_variability": duration_var.round(2),
            "bedtime_variability": bedtime_var.round(1),
            "wake_variability": wake_var.round(1),
            "avg_bedtime": avg_bedtime.round(1),
            "satisfaction_rate": satisfaction.round(3),
            "weekly_activity_minutes": activity.round(1),
            "age": age,
        }
    )[FEATURE_NAMES]

    y = df.apply(label_week, axis=1).to_numpy()

    # Noise only near decision boundaries, where real ambiguity lives.
    # Uniform noise would swamp the rarer classes.
    near_boundary = (
        (np.abs(df["avg_sleep_hours"] - SLEEP_LOW) < 0.15)
        | (np.abs(df["avg_sleep_hours"] - SLEEP_HIGH) < 0.15)
        | (np.abs(df["bedtime_variability"] - TIMING_LIMIT) < 6)
        | (np.abs(df["satisfaction_rate"] - LOW_SATISFACTION) < 0.04)
    ).to_numpy()
    flip = near_boundary & (rng.random(n_samples) < 0.15)
    y = np.where(flip, rng.integers(0, len(CLASS_LABELS), n_samples), y)

    return df, pd.Series(y, name="recommendation")


def main() -> None:
    print("Building dataset...")
    X, y = build_dataset()
    print(f"  {len(X)} samples, {len(FEATURE_NAMES)} features")
    for cls, count in y.value_counts().sort_index().items():
        print(f"    {CLASS_LABELS[cls]:<38} {count:>5}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    print("\nTraining XGBoost classifier...")
    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="multi:softprob",
        num_class=len(CLASS_LABELS),
        random_state=RANDOM_SEED,
        eval_metric="mlogloss",
    )

    # Weight each class inversely to its frequency, so the less common
    # recommendations are learned rather than ignored.
    counts = y_train.value_counts()
    weights = y_train.map(lambda c: len(y_train) / (len(counts) * counts[c]))
    model.fit(X_train, y_train, sample_weight=weights)

    preds = model.predict(X_test)
    print(f"\nTest accuracy: {accuracy_score(y_test, preds):.3f}")
    print("(Agreement with the guideline-based labels on held-out synthetic data.)\n")
    print(
        classification_report(
            y_test,
            preds,
            target_names=[CLASS_LABELS[i] for i in sorted(CLASS_LABELS)],
            zero_division=0,
        )
    )

    print("Building SHAP explainer...")
    explainer = shap.TreeExplainer(model)

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODEL_DIR, "sleep_model.joblib"))
    joblib.dump(explainer, os.path.join(MODEL_DIR, "sleep_explainer.joblib"))
    X_train.median().to_json(os.path.join(MODEL_DIR, "sleep_feature_medians.json"))

    print(f"\nSaved sleep model artifacts to {os.path.abspath(MODEL_DIR)}")


if __name__ == "__main__":
    main()
