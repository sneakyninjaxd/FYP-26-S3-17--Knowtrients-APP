"""
Trains the Knowtrients fitness recommendation model.

Run from the backend/ directory:
    python ml/train_fitness_model.py

Mirrors ml/train_model.py (the diet model): an XGBoost multiclass classifier
explained with SHAP TreeExplainer, so attributions are exact rather than
approximated (constraint C-01).

WHERE THE LABELS COME FROM
--------------------------
No public dataset pairs people's weekly activity with the advice they should
have received, so the labels are assigned by rule. The rules are taken from
published guidance rather than invented:

  - WHO Guidelines on Physical Activity and Sedentary Behaviour (2020):
    at least 150 minutes of moderate-equivalent activity a week, and
    muscle-strengthening activity on 2 or more days.
  - 7-9 hours of sleep a night for adults.

So the model learns to apply public guidance to a user's week. It does not
learn anything those guidelines don't already say — the value it adds is
weighing several guidelines at once and explaining, via SHAP, which of the
user's habits drove the result.

The feature *distributions* are synthetic but correlated the way real data
is: more active people tend to take more steps and train more often, and
vigorous activity declines with age. Replacing `build_dataset()` with real
weekly activity data (e.g. NHANES accelerometry) would make the distributions
real while keeping the same labelling rules.

ACCURACY
--------
Test accuracy measures how well the model reproduces the labelling rules on
held-out synthetic data. It shows the pipeline works end to end; it is not
evidence of real-world effectiveness.
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
from app.ml.fitness_features import CLASS_LABELS, FEATURE_NAMES, GUIDELINES  # noqa: E402

RANDOM_SEED = 42
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "ml", "artifacts")

MVPA_TARGET = GUIDELINES["weekly_mvpa_minutes"][0]
STRENGTH_TARGET = GUIDELINES["strength_sessions"][0]
SLEEP_TARGET = GUIDELINES["avg_sleep_hours"][0]
VARIABILITY_LIMIT = GUIDELINES["sleep_variability"][0]

# Recovery concern: a lot of hard training on too little sleep. Set below the
# general sleep minimum, since the concern is acute under-recovery rather than
# ordinary short sleep.
RECOVERY_VIGOROUS_MIN = 150
RECOVERY_SLEEP_MAX = 6.5


def label_week(row: pd.Series) -> int:
    """
    Assigns one recommendation to a week, in priority order.

    Priority matters because a week can fail several guidelines at once, and
    the user should be told the most important thing first:

      1. Recovery — heavy training on short sleep is the one pattern that
         carries injury risk, so it outranks everything.
      2. Activity — the core WHO guideline.
      3. Sleep — affects everything else.
      4. Strength — the second WHO guideline.
      5. Otherwise on track.
    """
    if (
        row["weekly_vigorous_minutes"] >= RECOVERY_VIGOROUS_MIN
        and row["avg_sleep_hours"] < RECOVERY_SLEEP_MAX
    ):
        return 3
    if row["weekly_mvpa_minutes"] < MVPA_TARGET:
        return 1
    if (
        row["avg_sleep_hours"] < SLEEP_TARGET
        or row["sleep_variability"] > VARIABILITY_LIMIT
    ):
        return 4
    if row["strength_sessions"] < STRENGTH_TARGET:
        return 2
    return 0


def build_dataset(n_samples: int = 5000) -> tuple[pd.DataFrame, pd.Series]:
    """
    Generates synthetic weeks with realistic correlations between features.

    Each simulated person has a latent activity propensity, which drives how
    often they exercise, how long, how many steps they take, and how likely
    they are to strength train. Age reduces vigorous activity; BMI is weakly
    and inversely related to activity. Sleep is drawn independently, since
    the relationship between exercise and sleep is weak at weekly scale.
    """
    rng = np.random.default_rng(RANDOM_SEED)

    age = rng.integers(18, 76, n_samples).astype(float)
    bmi = rng.normal(24.5, 4.2, n_samples).clip(16, 42)

    # Latent propensity, nudged down for higher BMI.
    propensity = rng.beta(2.0, 2.4, n_samples)
    propensity = (propensity - (bmi - 24.5) * 0.008).clip(0.02, 0.98)

    # A minority of people train hard. Without them the general population
    # almost never reaches 150 vigorous minutes, so the recovery class — the
    # only one carrying injury risk — would barely exist in the data and the
    # model would never learn to recognise it.
    athlete = rng.random(n_samples) < 0.12
    propensity = np.where(athlete, rng.uniform(0.80, 0.98, n_samples), propensity)

    active_days = rng.binomial(7, propensity).astype(float)

    # Session length rises with propensity; vigorous share falls with age.
    session_minutes = rng.normal(25 + 40 * propensity, 12).clip(10, 120)
    vigorous_share = (
        rng.beta(2, 5, n_samples) * (1.0 - (age - 18) / 120.0)
    ).clip(0.0, 0.9)
    vigorous_share = np.where(
        athlete, rng.uniform(0.45, 0.85, n_samples), vigorous_share
    )

    total_minutes = active_days * session_minutes
    vigorous = total_minutes * vigorous_share
    moderate = total_minutes - vigorous

    # WHO moderate-equivalent: vigorous minutes count double.
    mvpa = moderate + 2.0 * vigorous

    strength = rng.poisson(0.4 + 2.6 * propensity).astype(float).clip(0, 7)
    strength = np.minimum(strength, active_days)

    steps = rng.normal(3500 + 8500 * propensity, 1800).clip(800, 22000)

    sleep = rng.normal(6.9, 1.0, n_samples).clip(3.5, 10.5)
    variability = rng.gamma(2.0, 0.55, n_samples).clip(0.0, 4.5)

    df = pd.DataFrame(
        {
            "weekly_mvpa_minutes": mvpa.round(1),
            "weekly_vigorous_minutes": vigorous.round(1),
            "active_days": active_days,
            "strength_sessions": strength,
            "avg_daily_steps": steps.round(0),
            "avg_sleep_hours": sleep.round(2),
            "sleep_variability": variability.round(2),
            "age": age,
            "bmi": bmi.round(1),
        }
    )[FEATURE_NAMES]

    y = df.apply(label_week, axis=1).to_numpy()

    # Light label noise so the classes aren't perfectly separable.
    #
    # Uniform noise across all five classes would swamp the rare recovery
    # class: a few hundred random labels land in it at roughly the same rate
    # as in the common classes, so they outnumber the genuine cases. Noise is
    # applied only to weeks near a decision boundary instead, which is where
    # real ambiguity lives anyway.
    near_boundary = (
        (np.abs(df["weekly_mvpa_minutes"] - MVPA_TARGET) < 20)
        | (np.abs(df["avg_sleep_hours"] - SLEEP_TARGET) < 0.2)
        | (np.abs(df["strength_sessions"] - STRENGTH_TARGET) < 1)
    ).to_numpy()
    flip = near_boundary & (rng.random(n_samples) < 0.15)
    y = np.where(flip, rng.integers(0, len(CLASS_LABELS), n_samples), y)

    return df, pd.Series(y, name="recommendation")


def main() -> None:
    print("Building dataset...")
    X, y = build_dataset()
    print(f"  {len(X)} samples, {len(FEATURE_NAMES)} features")
    counts = y.value_counts().sort_index()
    for cls, count in counts.items():
        print(f"    {CLASS_LABELS[cls]:<36} {count:>5}")

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
    # Weight each class inversely to its frequency. Recovery weeks are rare
    # but the most important to catch; unweighted, the model could ignore
    # them and still score highly on overall accuracy.
    class_counts = y_train.value_counts()
    weights = y_train.map(lambda c: len(y_train) / (len(class_counts) * class_counts[c]))
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
    joblib.dump(model, os.path.join(MODEL_DIR, "fitness_model.joblib"))
    joblib.dump(explainer, os.path.join(MODEL_DIR, "fitness_explainer.joblib"))
    X_train.median().to_json(os.path.join(MODEL_DIR, "fitness_feature_medians.json"))

    print(f"\nSaved fitness model artifacts to {os.path.abspath(MODEL_DIR)}")


if __name__ == "__main__":
    main()
