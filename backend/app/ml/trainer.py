import os
import time
from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from app.ml.preprocessor import preprocess_and_split

MODELS_DIR = Path("models_store")
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _get_candidate_models(problem_type: str) -> dict[str, Any]:
    """Return dictionary of candidate models tailored to the problem type with high-speed execution."""
    if problem_type == "classification":
        return {
            "Random Forest Classifier": RandomForestClassifier(n_estimators=25, max_depth=6, n_jobs=1, random_state=42),
            "Gradient Boosting": GradientBoostingClassifier(n_estimators=25, max_depth=3, subsample=0.8, random_state=42),
            "Logistic Regression": LogisticRegression(max_iter=150, solver="lbfgs", random_state=42),
            "Decision Tree": DecisionTreeClassifier(max_depth=5, random_state=42),
        }
    else:
        return {
            "Random Forest Regressor": RandomForestRegressor(n_estimators=25, max_depth=6, n_jobs=1, random_state=42),
            "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=25, max_depth=3, subsample=0.8, random_state=42),
            "Ridge Regression": Ridge(alpha=1.0),
            "Linear Regression": LinearRegression(),
        }


def _extract_feature_importance(model: Any, feature_names: list[str]) -> list[dict[str, Any]]:
    """Extract and normalize feature importance scores."""
    importances = None
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        importances = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)

    if importances is None or len(importances) != len(feature_names):
        return []

    total = np.sum(importances)
    normalized = (importances / total * 100) if total > 0 else np.zeros_like(importances)

    ranking = [
        {"feature": feature_names[i], "importance": round(float(normalized[i]), 2)}
        for i in range(len(feature_names))
    ]
    ranking.sort(key=lambda x: x["importance"], reverse=True)
    return ranking[:15]


def train_automl_pipeline(
    file_path: str,
    target_column: str,
    dataset_id: int,
) -> dict[str, Any]:
    """
    Run full AutoML benchmark pipeline:
    1. Preprocesses data
    2. Trains candidate algorithms
    3. Evaluates and ranks models
    4. Serializes the best performing model
    """
    df = pd.read_csv(file_path)

    # 1. Preprocess & Split
    prep = preprocess_and_split(df, target_column=target_column)
    problem_type = prep["problem_type"]
    feature_names = prep["feature_names"]

    X_train = prep["X_train_scaled"]
    X_test = prep["X_test_scaled"]
    y_train = prep["y_train"]
    y_test = prep["y_test"]

    candidates = _get_candidate_models(problem_type)
    leaderboard = []

    trained_models = {}

    for name, model in candidates.items():
        try:
            start_t = time.perf_counter()
            model.fit(X_train, y_train)
            train_time = round((time.perf_counter() - start_t) * 1000, 2)

            y_pred = model.predict(X_test)
            trained_models[name] = model

            if problem_type == "classification":
                acc = round(float(accuracy_score(y_test, y_pred)), 4)
                prec = round(float(precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
                rec = round(float(recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
                f1 = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
                cm = confusion_matrix(y_test, y_pred).tolist()

                leaderboard.append(
                    {
                        "model_name": name,
                        "accuracy": acc,
                        "precision": prec,
                        "recall": rec,
                        "f1_score": f1,
                        "confusion_matrix": cm,
                        "training_time_ms": train_time,
                        "score": f1,
                    }
                )
            else:
                mse = round(float(mean_squared_error(y_test, y_pred)), 4)
                rmse = round(float(np.sqrt(mse)), 4)
                mae = round(float(mean_absolute_error(y_test, y_pred)), 4)
                r2 = round(float(r2_score(y_test, y_pred)), 4)

                leaderboard.append(
                    {
                        "model_name": name,
                        "r2_score": r2,
                        "rmse": rmse,
                        "mae": mae,
                        "mse": mse,
                        "training_time_ms": train_time,
                        "score": r2,
                    }
                )
        except Exception as exc:
            print(f"[AutoML] Model {name} training failed: {exc}")
            continue

    if not leaderboard:
        raise RuntimeError("All candidate models failed to train.")

    # 2. Rank models
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    best_model_info = leaderboard[0]
    best_model_name = best_model_info["model_name"]
    best_model = trained_models[best_model_name]

    # 3. Extract Feature Importance
    feature_importance = _extract_feature_importance(best_model, feature_names)

    # 4. Extract raw feature definitions for UI predictor
    raw_features = []
    sample_record = {}
    sample_row = df.head(1)
    has_sample = len(sample_row) > 0

    for col in prep["num_cols"]:
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        default_v = round(float(s.median()), 2) if not s.empty else 0.0

        sample_v = default_v
        if has_sample and col in sample_row:
            raw_val = sample_row[col].values[0]
            try:
                if not pd.isna(raw_val):
                    sample_v = round(float(raw_val), 2)
            except (ValueError, TypeError):
                sample_v = default_v

        raw_features.append({
            "name": col,
            "type": "numeric",
            "default_value": default_v,
            "min": round(float(s.min()), 2) if not s.empty else 0.0,
            "max": round(float(s.max()), 2) if not s.empty else 100.0,
            "sample_value": sample_v,
        })
        sample_record[col] = sample_v

    for col in prep["cat_cols"]:
        s = df[col].dropna().astype(str)
        unique_vals = [str(v).strip() for v in s.unique()[:15] if str(v).strip()]
        default_v = unique_vals[0] if unique_vals else "Missing"

        sample_v = default_v
        if has_sample and col in sample_row:
            raw_val = sample_row[col].values[0]
            if not pd.isna(raw_val) and str(raw_val).strip():
                sample_v = str(raw_val).strip()

        raw_features.append({
            "name": col,
            "type": "categorical",
            "options": unique_vals if unique_vals else [default_v],
            "default_value": default_v,
            "sample_value": sample_v,
        })
        sample_record[col] = sample_v

    # 5. Serialize winning pipeline
    model_filename = f"model_ds_{dataset_id}_{target_column}_{int(time.time())}.joblib"
    model_path = MODELS_DIR / model_filename

    artifact = {
        "dataset_id": dataset_id,
        "target_column": target_column,
        "problem_type": problem_type,
        "model_name": best_model_name,
        "model": best_model,
        "scaler": prep["scaler"],
        "label_encoder": prep["label_encoder"],
        "target_classes": prep["target_classes"],
        "feature_names": feature_names,
        "num_cols": prep["num_cols"],
        "cat_cols": prep["cat_cols"],
        "raw_features": raw_features,
        "created_at": time.time(),
    }
    joblib.dump(artifact, model_path)

    result_summary = {
        "dataset_id": dataset_id,
        "target_column": target_column,
        "problem_type": problem_type,
        "total_samples": prep["total_samples"],
        "train_samples": prep["train_samples"],
        "test_samples": prep["test_samples"],
        "num_features": prep["num_features"],
        "feature_names": feature_names,
        "raw_features": raw_features,
        "sample_record": sample_record,
        "target_classes": prep["target_classes"],
        "best_model_name": best_model_name,
        "best_model_score": best_model_info["score"],
        "leaderboard": leaderboard,
        "feature_importance": feature_importance,
        "model_file": str(model_path),
    }

    # Save benchmark cache so page refresh restores it immediately
    try:
        benchmark_path = MODELS_DIR / f"benchmark_ds_{dataset_id}.joblib"
        joblib.dump(result_summary, benchmark_path)
    except Exception as save_err:
        print(f"[AutoML Cache] Failed to save benchmark cache: {save_err}")

    return result_summary
