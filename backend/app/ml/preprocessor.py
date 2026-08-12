from typing import Any
import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler


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


def get_target_candidates(file_path: str) -> list[dict[str, Any]]:
    """Analyze all columns in a dataset and return suitable target candidates with suggested problem types."""
    df = pd.read_csv(file_path)
    total_rows = len(df)

    candidates = []
    for col in df.columns:
        series = df[col]
        missing_count = int(series.isna().sum())
        unique_count = int(series.nunique())

        # Skip constant columns or 100% missing columns
        if unique_count <= 1 or missing_count == total_rows:
            continue

        # Skip high-cardinality non-numeric (likely unique IDs/names)
        if (series.dtype == object or str(series.dtype) == "string") and total_rows > 20 and unique_count / total_rows > 0.9:
            continue

        prob_type = detect_problem_type(series)

        candidates.append(
            {
                "name": str(col),
                "data_type": str(series.dtype),
                "unique_count": unique_count,
                "missing_count": missing_count,
                "suggested_task": prob_type,
                "sample_values": [str(v) for v in series.dropna().unique()[:5]],
            }
        )

    return candidates


def preprocess_and_split(
    df: pd.DataFrame,
    target_column: str,
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    Sanitize, encode, impute, and split dataset for machine learning.
    """
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    # 1. Drop rows with missing target
    data = df.dropna(subset=[target_column]).copy()
    if len(data) < 5:
        raise ValueError("Dataset has too few records (< 5) after removing missing target values.")

    problem_type = detect_problem_type(data[target_column])

    # 2. Separate Target y
    y_raw = data[target_column]
    label_encoder = None
    target_classes = []

    if problem_type == "classification":
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y_raw.astype(str))
        target_classes = [str(cls) for cls in label_encoder.classes_]
    else:
        y = pd.to_numeric(y_raw, errors="coerce").fillna(y_raw.median()).values

    # 3. Process Features X
    X_raw = data.drop(columns=[target_column])

    # Remove high-cardinality ID columns and constant columns
    drop_cols = []
    for col in X_raw.columns:
        series = X_raw[col]
        if series.nunique() <= 1:
            drop_cols.append(col)
        elif series.dtype == object and len(X_raw) > 20 and series.nunique() / len(X_raw) > 0.85:
            drop_cols.append(col)

    X_filtered = X_raw.drop(columns=drop_cols)
    if X_filtered.shape[1] == 0:
        # If all were dropped, keep original features without constant ones
        X_filtered = X_raw

    # Identify numeric vs categorical
    num_cols = [c for c in X_filtered.columns if is_numeric_dtype(X_filtered[c]) and not is_bool_dtype(X_filtered[c])]
    cat_cols = [c for c in X_filtered.columns if c not in num_cols]

    # Imputation & Encoding
    X_processed = pd.DataFrame(index=X_filtered.index)

    # Impute and add numeric features
    for col in num_cols:
        clean_s = pd.to_numeric(X_filtered[col], errors="coerce")
        median_val = clean_s.median() if not clean_s.dropna().empty else 0.0
        X_processed[col] = clean_s.fillna(median_val)

    # Impute and One-Hot Encode categorical features
    for col in cat_cols:
        mode_val = str(X_filtered[col].mode()[0]) if not X_filtered[col].dropna().empty else "Missing"
        clean_cat = X_filtered[col].fillna(mode_val).astype(str)
        # One-hot encode with limit to top 15 categories to avoid explosion
        top_cats = clean_cat.value_counts().head(15).index
        clean_cat_capped = clean_cat.apply(lambda v: v if v in top_cats else "Other")
        dummies = pd.get_dummies(clean_cat_capped, prefix=col, drop_first=False)
        X_processed = pd.concat([X_processed, dummies], axis=1)

    feature_names = list(X_processed.columns)

    # 4. Train/Test Split
    stratify = None
    if problem_type == "classification" and len(np.unique(y)) > 1:
        # Check if every class has at least 2 samples for stratification
        class_counts = pd.Series(y).value_counts()
        if (class_counts >= 2).all():
            stratify = y

    X_train, X_test, y_train, y_test = train_test_split(
        X_processed.values,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    return {
        "problem_type": problem_type,
        "target_column": target_column,
        "feature_names": feature_names,
        "num_features": len(feature_names),
        "target_classes": target_classes,
        "label_encoder": label_encoder,
        "scaler": scaler,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "X_train": X_train,
        "X_test": X_test,
        "X_train_scaled": X_train_scaled,
        "X_test_scaled": X_test_scaled,
        "y_train": y_train,
        "y_test": y_test,
        "total_samples": len(data),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
    }
