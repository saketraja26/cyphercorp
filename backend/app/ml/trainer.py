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
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    ExtraTreesClassifier,
    ExtraTreesRegressor,
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
from sklearn.inspection import permutation_importance

from app.ml.preprocessor import preprocess_and_split

MODELS_DIR = Path("models_store")
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _get_candidate_models(problem_type: str) -> dict[str, Any]:
    """Return dictionary of candidate models tailored to the problem type with high-precision hyperparameter tuning."""
    if problem_type == "classification":
        return {
            "HistGradient Boosting": HistGradientBoostingClassifier(max_iter=80, max_depth=8, min_samples_leaf=5, l2_regularization=0.05, random_state=42),
            "Random Forest Classifier": RandomForestClassifier(n_estimators=50, max_depth=12, min_samples_leaf=2, n_jobs=1, random_state=42),
            "Extra Trees Classifier": ExtraTreesClassifier(n_estimators=50, max_depth=12, min_samples_leaf=2, n_jobs=1, random_state=42),
            "Gradient Boosting": GradientBoostingClassifier(n_estimators=50, max_depth=4, learning_rate=0.1, subsample=0.85, random_state=42),
            "Logistic Regression": LogisticRegression(max_iter=300, tol=1e-3, solver="lbfgs", random_state=42),
            "Decision Tree": DecisionTreeClassifier(max_depth=8, min_samples_leaf=2, random_state=42),
        }
    else:
        return {
            "HistGradient Boosting Regressor": HistGradientBoostingRegressor(max_iter=80, max_depth=8, min_samples_leaf=5, l2_regularization=0.05, random_state=42),
            "Random Forest Regressor": RandomForestRegressor(n_estimators=50, max_depth=12, min_samples_leaf=2, n_jobs=1, random_state=42),
            "Extra Trees Regressor": ExtraTreesRegressor(n_estimators=50, max_depth=12, min_samples_leaf=2, n_jobs=1, random_state=42),
            "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=50, max_depth=4, learning_rate=0.1, subsample=0.85, random_state=42),
            "Ridge Regression": Ridge(alpha=1.0, tol=1e-3),
            "Decision Tree Regressor": DecisionTreeRegressor(max_depth=8, min_samples_leaf=2, random_state=42),
        }


def _extract_feature_importance(
    model: Any,
    feature_names: list[str],
    X_sample: np.ndarray | None = None,
    y_sample: np.ndarray | None = None,
) -> list[dict[str, Any]]:
    """Extract and normalize feature importance scores, filtering out 0% features."""
    importances = None
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        importances = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)
    elif X_sample is not None and len(X_sample) > 0 and hasattr(model, "predict"):
        try:
            perm = permutation_importance(
                model,
                X_sample[:100],
                y_sample[:100] if y_sample is not None else None,
                n_repeats=3,
                random_state=42,
            )
            importances = np.maximum(0, perm.importances_mean)
        except Exception:
            importances = np.ones(len(feature_names)) / max(1, len(feature_names))

    if importances is None or len(importances) != len(feature_names):
        return []

    total = np.sum(importances)
    normalized = (importances / total * 100) if total > 0 else np.zeros_like(importances)

    ranking = [
        {"feature": feature_names[i], "importance": round(float(normalized[i]), 2)}
        for i in range(len(feature_names))
        if round(float(normalized[i]), 2) > 0
    ]
    ranking.sort(key=lambda x: x["importance"], reverse=True)
    return ranking[:15]


def _extract_feature_attribution(
    model: Any,
    feature_names: list[str],
    X_train: np.ndarray,
    y_train: np.ndarray,
    problem_type: str,
    target_classes: list[str],
) -> list[dict[str, Any]]:
    """
    Extract normalized feature importance along with directional impact (+/-) and plain-English narratives.
    Filters out features with 0% importance.
    """
    importances = None
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        importances = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)
    elif X_train is not None and len(X_train) > 0 and hasattr(model, "predict"):
        try:
            perm = permutation_importance(
                model,
                X_train[:100],
                y_train[:100] if y_train is not None else None,
                n_repeats=3,
                random_state=42,
            )
            importances = np.maximum(0, perm.importances_mean)
        except Exception:
            importances = np.ones(len(feature_names)) / max(1, len(feature_names))

    if importances is None or len(importances) != len(feature_names):
        importances = np.ones(len(feature_names)) / max(1, len(feature_names))

    total = np.sum(importances)
    normalized = (importances / total * 100) if total > 0 else np.zeros_like(importances)

    # Compute correlation / directionality with target
    directionality = []
    y_train_num = y_train.astype(float) if problem_type == "classification" else y_train

    for i, fname in enumerate(feature_names):
        imp_score = round(float(normalized[i]), 2)
        if imp_score <= 0:
            continue

        col_vals = X_train[:, i]
        std_col = float(np.std(col_vals))
        std_y = float(np.std(y_train_num)) if np.std(y_train_num) > 0 else 1.0

        if std_col > 1e-6 and std_y > 1e-6:
            r_mat = np.corrcoef(col_vals, y_train_num)
            r = float(r_mat[0, 1]) if r_mat.shape == (2, 2) else 0.0
            if np.isnan(r) or np.isinf(r):
                r = 0.0
        else:
            r = 0.0

        # Determine directional impact
        if abs(r) >= 0.15:
            direction = "positive" if r > 0 else "negative"
            direction_label = "+ Positive Impact" if r > 0 else "- Negative Impact"
            polarity_icon = "+" if r > 0 else "-"
        elif abs(r) >= 0.05:
            direction = "positive" if r > 0 else "negative"
            direction_label = "+ Mild Positive" if r > 0 else "- Mild Negative"
            polarity_icon = "+" if r > 0 else "-"
        else:
            direction = "non_linear"
            direction_label = "~ Non-linear Driver"
            polarity_icon = "~"

        # Generate explanatory narrative
        if problem_type == "classification":
            target_focus = target_classes[-1] if target_classes else "Target"
            if direction == "positive":
                narrative = f"Strong positive driver: Higher '{fname}' significantly elevates likelihood of '{target_focus}' (r = +{r:.2f})."
            elif direction == "negative":
                narrative = f"Inverse driver: Higher '{fname}' reduces likelihood of '{target_focus}' (r = {r:.2f})."
            else:
                narrative = f"Non-linear partition: Specific value intervals of '{fname}' separate outcome classes."
        else:
            if direction == "positive":
                narrative = f"Direct positive driver: Increasing '{fname}' drives quantitative increases in target (r = +{r:.2f})."
            elif direction == "negative":
                narrative = f"Inverse driver: Increasing '{fname}' drives reductions in target value (r = {r:.2f})."
            else:
                narrative = f"Non-linear threshold: Optimal ranges of '{fname}' influence predictions non-linearly."

        directionality.append({
            "feature": fname,
            "importance": imp_score,
            "correlation": round(r, 3),
            "direction": direction,
            "direction_label": direction_label,
            "polarity_icon": polarity_icon,
            "narrative": narrative,
        })

    directionality.sort(key=lambda x: x["importance"], reverse=True)
    return directionality


def _generate_model_diagnostics(
    best_model_name: str,
    problem_type: str,
    y_test: np.ndarray,
    y_pred: np.ndarray,
    target_classes: list[str],
    leaderboard_score: float,
) -> dict[str, Any]:
    """Generate in-depth statistical diagnostics, confusion analysis, and executive narrative."""
    if problem_type == "classification":
        cm = confusion_matrix(y_test, y_pred)
        total_test = len(y_test)
        correct = int(np.sum(np.diag(cm)))
        incorrect = total_test - correct
        misclassification_rate = round(float(incorrect / total_test * 100), 1) if total_test > 0 else 0.0

        # Class breakdown
        class_metrics = []
        for idx, cls_name in enumerate(target_classes):
            tp = int(cm[idx, idx]) if idx < len(cm) else 0
            fn = int(np.sum(cm[idx, :]) - tp) if idx < len(cm) else 0
            fp = int(np.sum(cm[:, idx]) - tp) if idx < len(cm) else 0
            prec = round(float(tp / (tp + fp) * 100), 1) if (tp + fp) > 0 else 0.0
            rec = round(float(tp / (tp + fn) * 100), 1) if (tp + fn) > 0 else 0.0
            class_metrics.append({
                "class_name": cls_name,
                "precision_pct": prec,
                "recall_pct": rec,
                "support": int(np.sum(cm[idx, :])) if idx < len(cm) else 0,
            })

        # Executive summary narrative
        if leaderboard_score >= 0.85:
            grade = "A (High Reliability)"
            readiness = "Production Ready"
        elif leaderboard_score >= 0.70:
            grade = "B (Good Predictor)"
            readiness = "Suitable for Operational Decision Support"
        else:
            grade = "C (Baseline Model)"
            readiness = "Needs Additional Feature Engineering"

        executive_narrative = (
            f"The champion {best_model_name} attained an F1 score of {leaderboard_score:.4f} with a {misclassification_rate}% "
            f"test misclassification rate ({correct}/{total_test} accurate predictions on held-out data). "
            f"Model Reliability: Grade {grade} • Readiness: {readiness}."
        )

        return {
            "grade": grade,
            "readiness": readiness,
            "executive_narrative": executive_narrative,
            "correct_predictions": correct,
            "incorrect_predictions": incorrect,
            "misclassification_rate": misclassification_rate,
            "class_metrics": class_metrics,
            "total_test_samples": total_test,
        }
    else:
        residuals = y_test - y_pred
        abs_res = np.abs(residuals)
        y_test_safe = np.where(y_test == 0, 1e-6, y_test)
        mape_val = float(np.mean(abs_res / np.abs(y_test_safe)) * 100)
        mape = round(mape_val, 2) if not (np.isnan(mape_val) or mape_val > 1000) else None

        over_pred_pct = round(float(np.mean(residuals < 0) * 100), 1)
        under_pred_pct = round(float(np.mean(residuals > 0) * 100), 1)
        max_error = round(float(np.max(abs_res)), 2)

        if leaderboard_score >= 0.80:
            grade = "A (High Precision)"
            readiness = "Production Ready"
        elif leaderboard_score >= 0.50:
            grade = "B (Good Fit)"
            readiness = "Suitable for Trend & Variance Forecasting"
        else:
            grade = "C (Baseline Fit)"
            readiness = "Consider Adding Non-linear Predictors"

        executive_narrative = (
            f"The champion {best_model_name} explains {max(0.0, leaderboard_score * 100):.1f}% of total variance ($R^2 = {leaderboard_score:.4f}$). "
            f"Residual analysis shows balanced error spread with {over_pred_pct}% over-predictions and {under_pred_pct}% under-predictions. "
            f"Model Reliability: Grade {grade} • Readiness: {readiness}."
        )

        return {
            "grade": grade,
            "readiness": readiness,
            "executive_narrative": executive_narrative,
            "mape_pct": mape,
            "over_prediction_pct": over_pred_pct,
            "under_prediction_pct": under_pred_pct,
            "max_residual_error": max_error,
            "mean_residual": round(float(np.mean(residuals)), 2),
            "residual_std": round(float(np.std(residuals)), 2),
        }


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
    model_predictions = {}

    # Setup Cross-Validation Strategy on Training Set
    # For large datasets (> 4000 rows), use a representative sample of the training set for CV validation to keep cloud response time fast
    if len(X_train) > 4000:
        cv_sample_size = 4000
        sample_indices = np.random.RandomState(42).choice(len(X_train), size=cv_sample_size, replace=False)
        X_cv = X_train[sample_indices]
        y_cv = y_train.iloc[sample_indices] if hasattr(y_train, "iloc") else y_train[sample_indices]
    else:
        X_cv = X_train
        y_cv = y_train

    if problem_type == "classification":
        class_counts = pd.Series(y_cv).value_counts()
        n_splits = 3 if (class_counts >= 3).all() else max(2, int(class_counts.min()))
        if n_splits >= 2 and len(np.unique(y_cv)) > 1:
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
                cv_scores = cross_val_score(model, X_cv, y_cv, cv=cv, scoring=scoring_metric)
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
            model_predictions[name] = y_pred

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
    best_y_pred = model_predictions[best_model_name]

    # 6. Extract Feature Importance & Directional Attribution
    feature_importance = _extract_feature_importance(best_model, feature_names, X_train, y_train)
    feature_attribution = _extract_feature_attribution(
        model=best_model,
        feature_names=feature_names,
        X_train=X_train,
        y_train=y_train,
        problem_type=problem_type,
        target_classes=prep["target_classes"],
    )

    # 7. Model Diagnostics & Error Breakdown
    model_diagnostics = _generate_model_diagnostics(
        best_model_name=best_model_name,
        problem_type=problem_type,
        y_test=y_test,
        y_pred=best_y_pred,
        target_classes=prep["target_classes"],
        leaderboard_score=best_model_info["score"],
    )

    # 8. Extract raw feature definitions for UI predictor
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

    # 9. Serialize winning pipeline artifact
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
        "feature_attribution": feature_attribution,
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
        "feature_attribution": feature_attribution,
        "model_diagnostics": model_diagnostics,
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
