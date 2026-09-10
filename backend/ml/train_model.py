"""
Trains the Knowtrients nutrition recommendation model.

Run from the backend/ directory:
    python ml/train_model.py

REPLACING THE SYNTHETIC DATA
----------------------------
`build_dataset()` below generates synthetic data so the pipeline is runnable
end-to-end before a real dataset is sourced. To use real data (e.g. NHANES
dietary recall, or a Kaggle nutrition dataset), replace the body of
`build_dataset()` with something that loads your CSV and returns:

    X : DataFrame with columns exactly matching FEATURE_NAMES, in that order
    y : Series of integer class labels matching CLASS_LABELS

Nothing else in the file needs to change.
"""

import os
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.ml.features import FEATURE_NAMES, CLASS_LABELS

RANDOM_SEED = 42
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "ml", "artifacts")


def build_dataset(n_samples: int = 4000) -> tuple[pd.DataFrame, pd.Series]:
    """
    Generates synthetic dietary intake records with rule-based labels.

    The rules deliberately create learnable structure so SHAP has something
    meaningful to attribute. Replace this function with real data loading.
    """
    rng = np.random.default_rng(RANDOM_SEED)

    df = pd.DataFrame(
        {
            "fiber_g": rng.normal(22, 9, n_samples).clip(2, 60),
            "sugar_g": rng.normal(45, 22, n_samples).clip(0, 140),
            "sodium_mg": rng.normal(2900, 1100, n_samples).clip(500, 7000),
            "saturated_fat_g": rng.normal(20, 9, n_samples).clip(1, 60),
            "protein_g": rng.normal(68, 22, n_samples).clip(15, 160),
            "calories": rng.normal(2150, 480, n_samples).clip(1100, 4000),
            "vegetable_servings": rng.normal(2.6, 1.4, n_samples).clip(0, 9),
            "water_ml": rng.normal(1900, 650, n_samples).clip(300, 4500),
            "age": rng.integers(18, 70, n_samples).astype(float),
            "bmi": rng.normal(24.5, 4.2, n_samples).clip(16, 42),
        }
    )[FEATURE_NAMES]

    # Rule-based labelling. Each condition scores a concern; highest wins.
    fiber_concern = (df["fiber_g"] < 20).astype(int) + (df["vegetable_servings"] < 2.5).astype(int)
    sugar_concern = (df["sugar_g"] > 50).astype(int) + (df["sugar_g"] > 75).astype(int)
    sodium_fat_concern = (df["sodium_mg"] > 3000).astype(int) + (df["saturated_fat_g"] > 22).astype(int)

    concerns = np.vstack([fiber_concern, sugar_concern, sodium_fat_concern]).T
    max_concern = concerns.max(axis=1)
    winner = concerns.argmax(axis=1) + 1  # classes 1, 2, 3

    y = np.where(max_concern == 0, 0, winner)

    # Light label noise so the model isn't perfectly separable (more realistic).
    flip = rng.random(n_samples) < 0.04
    y = np.where(flip, rng.integers(0, 4, n_samples), y)

    return df, pd.Series(y, name="recommendation")


def main() -> None:
    print("Building dataset...")
    X, y = build_dataset()
    print(f"  {len(X)} samples, {len(FEATURE_NAMES)} features")
    print(f"  class distribution: {y.value_counts().sort_index().to_dict()}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    print("\nTraining XGBoost classifier...")
    model = xgb.XGBClassifier(
        n_estimators=250,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="multi:softprob",
        num_class=len(CLASS_LABELS),
        random_state=RANDOM_SEED,
        eval_metric="mlogloss",
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print(f"\nTest accuracy: {accuracy_score(y_test, preds):.3f}\n")
    print(
        classification_report(
            y_test, preds, target_names=[CLASS_LABELS[i] for i in sorted(CLASS_LABELS)]
        )
    )

    print("Building SHAP explainer...")
    explainer = shap.TreeExplainer(model)

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODEL_DIR, "model.joblib"))
    joblib.dump(explainer, os.path.join(MODEL_DIR, "explainer.joblib"))

    # Median feature values, used at inference time to say whether a user's
    # value is higher or lower than typical.
    X_train.median().to_json(os.path.join(MODEL_DIR, "feature_medians.json"))

    print(f"\nSaved model artifacts to {os.path.abspath(MODEL_DIR)}")


if __name__ == "__main__":
    main()
