import math
from typing import Any
import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype

from app.profiling.identifiers import is_identifier_column


def _safe_float(val: Any) -> float | None:
    """Safely convert value to float, returning None if NaN, Inf, or invalid."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except (TypeError, ValueError):
        return None


def calculate_statistics(file_path: str) -> dict[str, Any]:
    """
    Calculate comprehensive descriptive statistics for all columns in a dataset.
    Guarantees safety against empty datasets, all-null columns, and constant columns.
    """
    df = pd.read_csv(file_path)

    total_rows = int(df.shape[0])
    total_cols = int(df.shape[1])

    statistics = {
        "row_count": total_rows,
        "column_count": total_cols,
        "columns": [],
    }

    for column in df.columns:
        series = df[column]
        missing_count = int(series.isna().sum())
        missing_percentage = (
            round(float(missing_count / total_rows * 100), 2)
            if total_rows > 0
            else 0.0
        )
        unique_count = int(series.nunique(dropna=True))

        column_info = {
            "name": str(column),
            "dtype": str(series.dtype),
            "data_type": str(series.dtype),
            "missing_count": missing_count,
            "missing_percentage": missing_percentage,
            "unique_count": unique_count,
            "statistics": None,
            "categorical_statistics": None,
        }

        # Detect semantic type
        semantic_type = "categorical"
        if is_identifier_column(series, str(column), total_rows):
            semantic_type = "identifier"
        elif is_bool_dtype(series):
            semantic_type = "boolean"
        elif is_numeric_dtype(series):
            semantic_type = "numeric"

        column_info["semantic_type"] = semantic_type

        # Check if numeric (excluding boolean)
        if is_numeric_dtype(series) and not is_bool_dtype(series):
            clean_num = pd.to_numeric(series, errors="coerce").dropna()
            if not clean_num.empty:
                q25 = clean_num.quantile(0.25) if len(clean_num) > 1 else clean_num.min()
                q75 = clean_num.quantile(0.75) if len(clean_num) > 1 else clean_num.max()
                std_val = clean_num.std() if len(clean_num) > 1 else 0.0
                var_val = clean_num.var() if len(clean_num) > 1 else 0.0
                skew_val = clean_num.skew() if len(clean_num) > 2 else 0.0
                sum_val = clean_num.sum()

                column_info["statistics"] = {
                    "count": int(len(clean_num)),
                    "min": _safe_float(clean_num.min()),
                    "max": _safe_float(clean_num.max()),
                    "mean": _safe_float(clean_num.mean()),
                    "median": _safe_float(clean_num.median()),
                    "sum": _safe_float(sum_val),
                    "std": _safe_float(std_val),
                    "variance": _safe_float(var_val),
                    "q25": _safe_float(q25),
                    "q75": _safe_float(q75),
                    "skewness": _safe_float(skew_val),
                }
        else:
            # Categorical statistics
            clean_cat = series.dropna()
            if not clean_cat.empty:
                val_counts = clean_cat.value_counts()
                if not val_counts.empty:
                    top_val = str(val_counts.index[0])
                    top_freq = int(val_counts.iloc[0])
                    column_info["categorical_statistics"] = {
                        "count": int(len(clean_cat)),
                        "unique_count": unique_count,
                        "top_value": top_val,
                        "top_frequency": top_freq,
                        "top_percentage": round(top_freq / len(clean_cat) * 100, 2) if len(clean_cat) > 0 else 0.0,
                    }

        statistics["columns"].append(column_info)

    return statistics