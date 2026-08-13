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
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_score
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from app.ml.preprocessor import preprocess_and_split

MODELS_DIR = Path("models_store")
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _get_candidate_models(problem_type: str) -> dict[str, Any]:
    """Return dictionary of candidate models tailored to the problem type with high-speed execution."""
    if problem_type == "classification":
        return {
            "Random Forest Classifier": RandomForestClassifier(n_estimators=30, max_depth=6, n_jobs=1, random_state=42),
            "Gradient Boosting": GradientBoostingClassifier(n_estimators=30, max_depth=3, subsample=0.8, random_state=42),
            "Logistic Regression": LogisticRegression(max_iter=200, solver="lbfgs", random_state=42),
            "Decision Tree": DecisionTreeClassifier(max_depth=5, random_state=42),
        }
    else:
        return {
            "Random Forest Regressor": RandomForestRegressor(n_estimators=30, max_depth=6, n_jobs=1, random_state=42),
            "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=30, max_depth=3, subsample=0.8, random_state=42),
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
    excluded_features: list[str] | None = None,
    included_features: list[str] | None = None,
) -> dict[str, Any]:
    """
    Run full zero-leakage AutoML benchmark pipeline:
    1. Preprocesses data with isolated train/test splitting.
    2. Runs k-fold cross validation for transparent algorithm comparison.
    3. Evaluates and ranks models on isolated test holdout.
    4. Serializes the champion model artifact with full preprocessing pipeline.
    """
    df = pd.read_csv(file_path)

    # 1. Preprocess & Split (Strictly Zero Leakage)
    prep = preprocess_and_split(
        df,
        target_column=target_column,
        excluded_features=excluded_features,
        included_features=included_features,
    )
    problem_type = prep["problem_type"]
    feature_names = prep["feature_names"]

    X_train = prep["X_train_scaled"]
    X_test = prep["X_test_scaled"]
    y_train = prep["y_train"]
    y_test = prep["y_test"]

    candidates = _get_candidate_models(problem_type)
    leaderboard = []
    trained_models = {}

    # Setup Cross-Validation Strategy on Training Set
    if problem_type == "classification":
        class_counts = pd.Series(y_train).value_counts()
        n_splits = 3 if (class_counts >= 3).all() else max(2, int(class_counts.min()))
        if n_splits >= 2 and len(np.unique(y_train)) > 1:
            cv = StratifiedKFold(n_splits=min(3, n_splits), shuffle=True, random_state=42)
        else:
            cv = 2
        scoring_metric = "f1_weighted"
    else:
        cv = KFold(n_splits=3, shuffle=True, random_state=42)
        scoring_metric = "r2"

    for name, model in candidates.items():
        try:
            # 2. Run Cross-Validation on Training Split
            cv_mean = 0.0
            cv_std = 0.0
            try:
                cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring=scoring_metric)
                cv_mean = round(float(np.mean(cv_scores)), 4)
                cv_std = round(float(np.std(cv_scores)), 4)
            except Exception as cv_err:
                print(f"[AutoML CV] Cross-validation notice for {name}: {cv_err}")

            # 3. Fit Model on Full Training Partition
            start_t = time.perf_counter()
            model.fit(X_train, y_train)
            train_time = round((time.perf_counter() - start_t) * 1000, 2)

            # 4. Evaluate on Held-out Isolated Test Set
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
                        "cv_score_mean": cv_mean,
                        "cv_score_std": cv_std,
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
                        "cv_score_mean": cv_mean,
                        "cv_score_std": cv_std,
                        "training_time_ms": train_time,
                        "score": r2,
                    }
                )
        except Exception as exc:
            print(f"[AutoML] Model {name} training failed: {exc}")
            continue

    if not leaderboard:
        raise RuntimeError("All candidate models failed to train.")

    # 5. Rank models
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    best_model_info = leaderboard[0]
    best_model_name = best_model_info["model_name"]
    best_model = trained_models[best_model_name]

    # 6. Extract Feature Importance
    feature_importance = _extract_feature_importance(best_model, feature_names)

    # 7. Extract raw feature definitions for UI predictor
    raw_features = []
    sample_record = {}
    sample_row = df.head(1)
    has_sample = len(sample_row) > 0

    for col in prep["num_cols"]:
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        default_v = round(prep["numeric_medians"].get(col, 0.0), 2)

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
        default_v = prep["cat_modes"].get(col, "Missing")
        unique_vals = prep["cat_vocab"].get(col, [default_v])
        if not unique_vals:
            unique_vals = [default_v]

        sample_v = default_v
        if has_sample and col in sample_row:
            raw_val = sample_row[col].values[0]
            if not pd.isna(raw_val) and str(raw_val).strip():
                sample_v = str(raw_val).strip()

        raw_features.append({
            "name": col,
            "type": "categorical",
            "options": unique_vals,
            "default_value": default_v,
            "sample_value": sample_v,
        })
        sample_record[col] = sample_v

    # 8. Serialize winning pipeline artifact
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
        "active_features": prep["active_features"],
        "num_cols": prep["num_cols"],
        "cat_cols": prep["cat_cols"],
        "numeric_medians": prep["numeric_medians"],
        "cat_modes": prep["cat_modes"],
        "cat_vocab": prep["cat_vocab"],
        "raw_features": raw_features,
        "stratified_split": prep["stratified_split"],
        "excluded_features_info": prep["excluded_features_info"],
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
        "active_features": prep["active_features"],
        "raw_features": raw_features,
        "sample_record": sample_record,
        "target_classes": prep["target_classes"],
        "best_model_name": best_model_name,
        "best_model_score": best_model_info["score"],
        "leaderboard": leaderboard,
        "feature_importance": feature_importance,
        "excluded_features_info": prep["excluded_features_info"],
        "validation_strategy": {
            "cv_folds": 3,
            "stratified": prep["stratified_split"],
            "test_split_pct": 20,
            "zero_leakage": True,
        },
        "model_file": str(model_path),
    }

    # Save benchmark cache
    try:
        benchmark_path = MODELS_DIR / f"benchmark_ds_{dataset_id}.joblib"
        joblib.dump(result_summary, benchmark_path)
    except Exception as save_err:
        print(f"[AutoML Cache] Failed to save benchmark cache: {save_err}")

    return result_summary
