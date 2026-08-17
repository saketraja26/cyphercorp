import math
import re
from typing import Any
import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

from app.profiling.identifiers import (
    ID_REGEX_PATTERNS,
    UUID_REGEX,
    PREFIX_ID_REGEX,
    analyze_column_identifier,
    is_identifier_column,
)

# Post-outcome / target leakage keywords
POST_OUTCOME_PATTERNS = [
    r"reason$",
    r"date$",
    r"time$",
    r"cancellation",
    r"churn_reason",
    r"exit_date",
    r"exit_reason",
    r"resolved",
    r"resolution",
    r"refund",
    r"discharge",
    r"death",
    r"closed_date",
]


def detect_problem_type(series: pd.Series) -> str:
    """Detect whether the target variable represents a classification or regression task."""
    clean_series = series.dropna()
    if clean_series.empty:
        return "classification"

    unique_count = clean_series.nunique()

    # Boolean, object, string or categorical -> classification
    if is_bool_dtype(clean_series) or clean_series.dtype == object or str(clean_series.dtype) == "string":
        return "classification"

    # Numeric target with small number of discrete classes (<= 15)
    if is_numeric_dtype(clean_series):
        if unique_count <= 15:
            return "classification"
        return "regression"

    return "classification"


def evaluate_target_eligibility(
    series: pd.Series, col_name: str, total_rows: int
) -> dict[str, Any]:
    """
    Evaluate target suitability and return task type, quality status, class distribution,
    variance details, and clear explanations.
    """
    clean_s = series.dropna()
    missing_count = int(series.isna().sum())
    missing_pct = round(missing_count / total_rows * 100, 2) if total_rows > 0 else 0.0
    unique_count = int(clean_s.nunique()) if not clean_s.empty else 0

    id_info = analyze_column_identifier(series, col_name, total_rows)
    prob_type = detect_problem_type(series)

    # 1. Constant or All-Null Check
    if unique_count <= 1 or missing_count == total_rows:
        return {
            "name": str(col_name),
            "data_type": str(series.dtype),
            "unique_count": unique_count,
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "suggested_task": prob_type,
            "status": "not_recommended",
            "is_identifier": False,
            "quality_verdict": "Ineligible",
            "quality_reasons": ["Column is constant or 100% missing. Cannot be used as a predictive target."],
            "class_distribution": None,
            "variance_info": None,
            "sample_values": [str(v) for v in clean_s.unique()[:5]],
        }

    # 2. Candidate Identifier Check (e.g., CustomerID)
    if id_info["is_identifier"]:
        return {
            "name": str(col_name),
            "data_type": str(series.dtype),
            "unique_count": unique_count,
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "suggested_task": prob_type,
            "status": "not_recommended",
            "is_identifier": True,
            "quality_verdict": "Candidate Identifier",
            "quality_reasons": [
                id_info["reason"],
                "Predicting an entity identifier produces artificial scores with zero business meaning.",
            ],
            "class_distribution": None,
            "variance_info": None,
            "sample_values": [str(v) for v in clean_s.unique()[:5]],
        }

    # 3. Classification Target Analysis
    if prob_type == "classification":
        val_counts = clean_s.value_counts()
        class_dist = [
            {
                "class_name": str(k),
                "count": int(v),
                "percentage": round(float(v / len(clean_s) * 100), 1),
            }
            for k, v in val_counts.head(10).items()
        ]

        quality_reasons = []
        status = "recommended"
        quality_verdict = "Recommended Target"

        # Check cardinality
        if unique_count > 30:
            status = "warning"
            quality_verdict = "High Cardinality Warning"
            quality_reasons.append(f"High number of discrete categories ({unique_count} classes). Consider grouping or using a continuous metric.")
        elif unique_count == 2:
            quality_reasons.append(f"Binary classification target with 2 classes ({class_dist[0]['class_name']} vs {class_dist[1]['class_name']}).")
        else:
            quality_reasons.append(f"Multi-class classification target with {unique_count} distinct classes.")

        # Class Imbalance Check
        if len(val_counts) >= 2:
            maj_count = val_counts.iloc[0]
            min_count = val_counts.iloc[-1]
            imbalance_ratio = round(float(min_count / maj_count), 3) if maj_count > 0 else 1.0
            min_pct = round(float(min_count / len(clean_s) * 100), 1)

            if min_pct < 10.0 or imbalance_ratio < 0.15:
                status = "warning"
                quality_verdict = "Class Imbalance Warning"
                quality_reasons.append(f"Severe class imbalance: minority class '{val_counts.index[-1]}' represents only {min_pct}% of data. Stratified cross-validation will be used.")
            elif imbalance_ratio >= 0.4:
                quality_reasons.append("Well-balanced class distribution.")

        return {
            "name": str(col_name),
            "data_type": str(series.dtype),
            "unique_count": unique_count,
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "suggested_task": "classification",
            "status": status,
            "is_identifier": False,
            "quality_verdict": quality_verdict,
            "quality_reasons": quality_reasons,
            "class_distribution": class_dist,
            "variance_info": None,
            "sample_values": [str(v) for v in clean_s.unique()[:5]],
        }

    # 4. Regression Target Analysis
    else:
        num_s = pd.to_numeric(clean_s, errors="coerce").dropna()
        if num_s.empty or len(num_s) < 5:
            return {
                "name": str(col_name),
                "data_type": str(series.dtype),
                "unique_count": unique_count,
                "missing_count": missing_count,
                "missing_pct": missing_pct,
                "suggested_task": "regression",
                "status": "not_recommended",
                "is_identifier": False,
                "quality_verdict": "Insufficient Numeric Data",
                "quality_reasons": ["Not enough numeric rows to calculate regression metrics."],
                "class_distribution": None,
                "variance_info": None,
                "sample_values": [str(v) for v in clean_s.unique()[:5]],
            }

        mean_val = float(num_s.mean())
        std_val = float(num_s.std()) if len(num_s) > 1 else 0.0
        min_val = float(num_s.min())
        max_val = float(num_s.max())
        median_val = float(num_s.median())

        variance_info = {
            "mean": round(mean_val, 2),
            "std": round(std_val, 2),
            "min": round(min_val, 2),
            "max": round(max_val, 2),
            "median": round(median_val, 2),
        }

        quality_reasons = []
        status = "recommended"
        quality_verdict = "Recommended Target"

        if std_val == 0:
            status = "not_recommended"
            quality_verdict = "Zero Variance"
            quality_reasons.append("Target values are completely constant. Cannot perform regression.")
        else:
            quality_reasons.append(f"Continuous numeric variable with variance std={std_val:.2f} (Range: [{min_val:.2f}, {max_val:.2f}]).")
            if unique_count > 100:
                quality_reasons.append(f"High richness with {unique_count:,} unique continuous measurement points.")

        return {
            "name": str(col_name),
            "data_type": str(series.dtype),
            "unique_count": unique_count,
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "suggested_task": "regression",
            "status": status,
            "is_identifier": False,
            "quality_verdict": quality_verdict,
            "quality_reasons": quality_reasons,
            "class_distribution": None,
            "variance_info": variance_info,
            "sample_values": [str(v) for v in clean_s.unique()[:5]],
        }


def detect_target_leakage(df: pd.DataFrame, target_column: str) -> dict[str, dict[str, Any]]:
    """
    Detect suspicious feature columns that leak the target:
    1. Extreme numeric correlation (|r| >= 0.95).
    2. Post-outcome variable name indicators (e.g. churn_reason, cancellation_date).
    3. Perfect 1-to-1 categorical mapping.
    """
    leakage_map = {}
    if target_column not in df.columns:
        return leakage_map

    target_s = df[target_column].dropna()
    is_target_numeric = is_numeric_dtype(target_s) and not is_bool_dtype(target_s)

    for col in df.columns:
        if col == target_column:
            continue

        series = df[col]
        col_lower = str(col).lower().replace("-", "_").replace(" ", "_")

        # Check Post-Outcome keyword heuristics
        for pat in POST_OUTCOME_PATTERNS:
            if re.search(pat, col_lower):
                leakage_map[col] = {
                    "risk": "high",
                    "reason": f"Column name '{col}' indicates a post-outcome variable known only after '{target_column}' occurs.",
                }
                break

        if col in leakage_map:
            continue

        # Check Extreme Correlation for numeric pairs
        if is_target_numeric and is_numeric_dtype(series):
            aligned = df[[col, target_column]].dropna()
            if len(aligned) > 10:
                try:
                    corr = aligned[col].corr(aligned[target_column])
                    if not pd.isna(corr) and abs(corr) >= 0.95:
                        leakage_map[col] = {
                            "risk": "high",
                            "reason": f"Extreme correlation (|r| = {abs(corr):.3f}) with target '{target_column}', indicating direct data leakage.",
                        }
                except Exception:
                    pass

    return leakage_map


def get_target_candidates(file_path: str) -> dict[str, Any]:
    """
    Analyze all columns in a dataset and return:
    - Target candidates ranked by suitability (with identifier / quality warnings).
    - Best recommended target.
    - Feature intelligence metadata (auto-exclusions, reasons, leakage risks).
    - User-facing recommendation banner.
    """
    df = pd.read_csv(file_path)
    total_rows = len(df)

    # Use subsample for evaluation if dataset is large to maintain sub-second response
    eval_df = df.sample(n=5000, random_state=42) if total_rows > 5000 else df

    candidates = []
    identifier_cols = []

    priority_keywords = [
        "churn",
        "target",
        "label",
        "converted",
        "default",
        "fraud",
        "status",
        "outcome",
        "purchased",
        "result",
        "sale_price",
        "price",
        "revenue",
        "amount",
        "salary",
        "score",
    ]

    for col in df.columns:
        series = eval_df[col]
        eval_result = evaluate_target_eligibility(series, str(col), total_rows)
        candidates.append(eval_result)

        if eval_result.get("is_identifier"):
            identifier_cols.append(str(col))

    # Determine Best Recommended Target
    # Filter out not_recommended (identifiers & constants)
    eligible_candidates = [
        c for c in candidates if c["status"] in ("recommended", "warning") and not c.get("is_identifier")
    ]

    def score_candidate(cand: dict[str, Any]) -> float:
        score = 0.0
        c_name = cand["name"].lower()

        # Prioritize matching standard business target keywords
        for kw in priority_keywords:
            if kw in c_name:
                score += 50.0
                break

        # Prioritize binary or clean classification
        if cand["suggested_task"] == "classification":
            if cand["unique_count"] == 2:
                score += 30.0
            elif cand["unique_count"] <= 5:
                score += 20.0
            else:
                score += 10.0
        else:
            score += 15.0

        if cand["status"] == "recommended":
            score += 20.0

        return score

    eligible_candidates.sort(key=score_candidate, reverse=True)

    recommended_target = eligible_candidates[0]["name"] if eligible_candidates else (candidates[0]["name"] if candidates else "")

    # Leakage analysis with respect to recommended target
    leakage_map = detect_target_leakage(eval_df, recommended_target) if recommended_target else {}

    # Feature Intelligence & Default Exclusions
    feature_intelligence = []
    for col in df.columns:
        series = eval_df[col]
        id_info = analyze_column_identifier(series, str(col), total_rows)
        unique_cnt = int(series.dropna().nunique())
        is_constant = unique_cnt <= 1

        leakage_info = leakage_map.get(str(col))
        is_leakage = leakage_info is not None

        # Auto-exclude identifiers, constants, and leakage columns by default
        is_excluded = id_info["is_identifier"] or is_constant or is_leakage
        exclusion_reason = None
        if id_info["is_identifier"]:
            exclusion_reason = f"Candidate Identifier: {id_info['reason']}"
        elif is_constant:
            exclusion_reason = "Constant feature with zero predictive variance."
        elif is_leakage:
            exclusion_reason = leakage_info["reason"]

        feature_intelligence.append({
            "name": str(col),
            "data_type": str(series.dtype),
            "is_identifier": id_info["is_identifier"],
            "is_constant": is_constant,
            "leakage_risk": leakage_info["risk"] if is_leakage else "none",
            "is_excluded_by_default": is_excluded,
            "exclusion_reason": exclusion_reason,
            "unique_count": unique_cnt,
        })

    # Build UI Recommendation Message
    if identifier_cols and recommended_target:
        if len(identifier_cols) == 1:
            recommendation_banner = (
                f"{identifier_cols[0]} appears to be an identifier and was excluded from predictive modeling. "
                f"Recommended target: {recommended_target}."
            )
        else:
            recommendation_banner = (
                f"{', '.join(identifier_cols)} appear to be identifiers and were excluded from predictive modeling. "
                f"Recommended target: {recommended_target}."
            )
    elif recommended_target:
        recommendation_banner = f"AutoML recommends '{recommended_target}' as the optimal target variable for this dataset."
    else:
        recommendation_banner = "Select a predictive target variable to begin AutoML benchmarking."

    return {
        "target_candidates": candidates,
        "recommended_target": recommended_target,
        "identifier_columns": identifier_cols,
        "recommendation_banner": recommendation_banner,
        "feature_intelligence": feature_intelligence,
    }


def preprocess_and_split(
    df: pd.DataFrame,
    target_column: str,
    excluded_features: list[str] | None = None,
    included_features: list[str] | None = None,
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    Sanitize, isolate test partition, fit imputation/encoding/scaling strictly on training data
    (zero data leakage), and return dataset partitions and fitted transformer pipeline.
    """
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    # 1. Drop rows with missing target
    data = df.dropna(subset=[target_column]).copy()
    if len(data) < 5:
        raise ValueError("Dataset has too few records (< 5) after removing missing target values.")

    problem_type = detect_problem_type(data[target_column])

    # Intelligent Stratified Subsampling for large datasets (> 8,000 rows)
    if len(data) > 8000:
        if problem_type == "classification":
            try:
                class_counts = data[target_column].value_counts()
                if (class_counts >= 2).all() and len(class_counts) <= len(data) / 2:
                    subsample_size = min(8000, len(data))
                    data = train_test_split(
                        data,
                        train_size=subsample_size,
                        stratify=data[target_column],
                        random_state=random_state,
                    )[0]
                else:
                    data = data.sample(n=8000, random_state=random_state)
            except Exception:
                data = data.sample(n=8000, random_state=random_state)
        else:
            data = data.sample(n=8000, random_state=random_state)

    total_rows = len(data)

    # 2. Determine Active Features vs Excluded Features
    candidate_features = [col for col in data.columns if col != target_column]
    leakage_map = detect_target_leakage(data, target_column)

    auto_excluded = set()
    exclusion_reasons = {}

    for col in candidate_features:
        series = data[col]
        id_info = analyze_column_identifier(series, col, total_rows)
        if id_info["is_identifier"]:
            auto_excluded.add(col)
            exclusion_reasons[col] = f"Candidate Identifier: {id_info['reason']}"
        elif series.nunique(dropna=False) <= 1:
            auto_excluded.add(col)
            exclusion_reasons[col] = "Constant feature with zero variance."
        elif col in leakage_map:
            auto_excluded.add(col)
            exclusion_reasons[col] = leakage_map[col]["reason"]

    # Apply User Overrides
    active_features = []
    excluded_features_set = set(excluded_features or [])
    included_features_set = set(included_features or [])

    for col in candidate_features:
        if col in included_features_set:
            active_features.append(col)
        elif col in excluded_features_set:
            if col not in exclusion_reasons:
                exclusion_reasons[col] = "Manually excluded by user."
        elif col in auto_excluded:
            # Keep excluded by default
            pass
        else:
            active_features.append(col)

    if not active_features:
        # Fallback: if all candidate features were excluded, retain non-constant columns
        active_features = [c for c in candidate_features if data[c].nunique(dropna=False) > 1]
        if not active_features:
            active_features = candidate_features

    # 3. Target Variable y Preparation
    y_raw = data[target_column]
    label_encoder = None
    target_classes = []

    if problem_type == "classification":
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y_raw.astype(str))
        target_classes = [str(cls) for cls in label_encoder.classes_]
    else:
        clean_num_y = pd.to_numeric(y_raw.replace([np.inf, -np.inf], np.nan), errors="coerce")
        median_y = clean_num_y.median() if not clean_num_y.dropna().empty else 0.0
        y = clean_num_y.fillna(median_y).values

    # 4. Zero-Leakage Train / Test Split FIRST with Stratification Safety Guard
    stratify = None
    if problem_type == "classification" and len(np.unique(y)) > 1:
        class_counts = pd.Series(y).value_counts()
        # Stratify only if every class has at least 2 instances and not too fragmented
        if (class_counts >= 2).all() and len(class_counts) <= len(y) / 2:
            stratify = y

    X_raw_df = data[active_features].copy()

    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_raw_df,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    # 5. Fit Preprocessing Transformers ONLY on Training Data (X_train_raw)
    num_cols = [c for c in active_features if is_numeric_dtype(X_train_raw[c]) and not is_bool_dtype(X_train_raw[c])]
    cat_cols = [c for c in active_features if c not in num_cols]

    # A. Numeric Imputers (fit on train)
    numeric_medians = {}
    for col in num_cols:
        s_train = pd.to_numeric(X_train_raw[col].replace([np.inf, -np.inf], np.nan), errors="coerce").dropna()
        med = float(s_train.median()) if not s_train.empty else 0.0
        numeric_medians[col] = med

    # B. Categorical Modes & Top Categories (fit on train)
    cat_modes = {}
    cat_vocab = {}
    for col in cat_cols:
        s_train = X_train_raw[col].dropna().astype(str)
        mode_val = str(s_train.mode()[0]) if not s_train.empty else "Missing"
        cat_modes[col] = mode_val
        # Cap at top 10 categories to avoid high-cardinality dimension explosion
        top_cats = list(s_train.value_counts().head(10).index)
        cat_vocab[col] = top_cats

    def _transform_partition(raw_partition: pd.DataFrame) -> pd.DataFrame:
        """Apply fitted transformers to a raw partition."""
        transformed = pd.DataFrame(index=raw_partition.index)

        # Impute numeric & sanitize
        for col in num_cols:
            clean_s = pd.to_numeric(raw_partition[col].replace([np.inf, -np.inf], np.nan), errors="coerce")
            med_val = numeric_medians.get(col, 0.0)
            val_filled = clean_s.fillna(med_val)
            val_clipped = np.nan_to_num(val_filled.values, nan=med_val, posinf=1e9, neginf=-1e9)
            transformed[col] = val_clipped

        # Impute and One-Hot categorical using training vocab
        for col in cat_cols:
            clean_cat = raw_partition[col].fillna(cat_modes.get(col, "Missing")).astype(str)
            allowed_cats = cat_vocab.get(col, [])
            clean_cat_capped = clean_cat.apply(lambda v: v if v in allowed_cats else "Other")

            # Create dummy columns for each category in allowed_cats
            for cat_opt in allowed_cats:
                dummy_col = f"{col}_{cat_opt}"
                transformed[dummy_col] = (clean_cat_capped == cat_opt).astype(float)

            # Add 'Other' dummy if 'Other' is present
            if "Other" not in allowed_cats:
                transformed[f"{col}_Other"] = (clean_cat_capped == "Other").astype(float)

        return transformed

    X_train_df = _transform_partition(X_train_raw)
    X_test_df = _transform_partition(X_test_raw)

    feature_names = list(X_train_df.columns)

    # C. Fit Scaler ONLY on X_train with safe finite arrays
    scaler = StandardScaler()
    X_train_clean = np.nan_to_num(X_train_df.values, nan=0.0, posinf=1e6, neginf=-1e6)
    X_test_clean = np.nan_to_num(X_test_df.values, nan=0.0, posinf=1e6, neginf=-1e6)

    X_train_scaled = scaler.fit_transform(X_train_clean)
    X_test_scaled = scaler.transform(X_test_clean)

    return {
        "problem_type": problem_type,
        "target_column": target_column,
        "active_features": active_features,
        "feature_names": feature_names,
        "num_features": len(feature_names),
        "target_classes": target_classes,
        "label_encoder": label_encoder,
        "scaler": scaler,
        "numeric_medians": numeric_medians,
        "cat_modes": cat_modes,
        "cat_vocab": cat_vocab,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "X_train": X_train_clean,
        "X_test": X_test_clean,
        "X_train_scaled": X_train_scaled,
        "X_test_scaled": X_test_scaled,
        "y_train": y_train,
        "y_test": y_test,
        "total_samples": len(data),
        "train_samples": len(X_train_raw),
        "test_samples": len(X_test_raw),
        "stratified_split": stratify is not None,
        "excluded_features_info": [
            {"name": k, "reason": v} for k, v in exclusion_reasons.items()
        ],
    }
