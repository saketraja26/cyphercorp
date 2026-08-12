import math
from typing import Any
import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype


def _detect_outliers(series: pd.Series) -> dict[str, Any]:
    """Detect outliers using IQR with Z-score fallback for concentrated distributions."""
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if len(clean) < 4:
        return {"outlier_count": 0, "outlier_percentage": 0.0, "lower_bound": None, "upper_bound": None}

    q1 = float(clean.quantile(0.25))
    q3 = float(clean.quantile(0.75))
    iqr = q3 - q1

    if iqr > 0:
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
    else:
        # Fallback for heavily concentrated distributions with zero IQR
        mean = float(clean.mean())
        std = float(clean.std())
        if std > 0:
            lower_bound = mean - 2.5 * std
            upper_bound = mean + 2.5 * std
        else:
            return {"outlier_count": 0, "outlier_percentage": 0.0, "lower_bound": round(q1, 2), "upper_bound": round(q3, 2)}

    outliers = clean[(clean < lower_bound) | (clean > upper_bound)]
    outlier_count = int(len(outliers))
    outlier_percentage = round(outlier_count / len(clean) * 100, 2)

    return {
        "outlier_count": outlier_count,
        "outlier_percentage": outlier_percentage,
        "lower_bound": round(lower_bound, 2),
        "upper_bound": round(upper_bound, 2),
    }


def analyze_data_quality(file_path: str) -> dict[str, Any]:
    """
    Perform deep data quality analysis on the dataset.
    Detects missingness, duplicates, constant columns, empty columns, ID columns,
    high cardinality, and numeric outliers, and computes an overall health score.
    """
    df = pd.read_csv(file_path)

    total_rows = int(df.shape[0])
    total_cols = int(df.shape[1])
    total_cells = total_rows * total_cols

    missing_cells = int(df.isna().sum().sum())
    missing_percentage = (
        round(float(missing_cells / total_cells * 100), 2)
        if total_cells > 0
        else 0.0
    )

    duplicate_rows = int(df.duplicated().sum()) if total_rows > 0 else 0
    duplicate_percentage = (
        round(float(duplicate_rows / total_rows * 100), 2)
        if total_rows > 0
        else 0.0
    )

    empty_columns = [
        col for col in df.columns if df[col].isna().all()
    ]

    constant_columns = [
        col for col in df.columns if df[col].nunique(dropna=False) <= 1
    ]

    id_columns = []
    high_cardinality_columns = []
    outlier_summary = []
    column_quality = []

    for column in df.columns:
        series = df[column]
        missing_count = int(series.isna().sum())
        col_missing_pct = (
            round(float(missing_count / total_rows * 100), 2)
            if total_rows > 0
            else 0.0
        )
        unique_count = int(series.nunique(dropna=True))

        # Check for potential ID column (100% unique, no nulls, > 1 row)
        is_id = False
        if total_rows > 1 and unique_count == total_rows and missing_count == 0:
            if not is_numeric_dtype(series) or "id" in column.lower() or "code" in column.lower():
                is_id = True
                id_columns.append(column)

        # Check high cardinality in non-numeric columns
        is_high_cardinality = False
        if not is_numeric_dtype(series) and total_rows >= 10:
            if unique_count / total_rows > 0.8:
                is_high_cardinality = True
                if not is_id:
                    high_cardinality_columns.append(column)

        # Check outliers for numeric columns
        outlier_info = None
        if is_numeric_dtype(series) and not is_bool_dtype(series):
            outlier_info = _detect_outliers(series)
            if outlier_info["outlier_count"] > 0:
                outlier_summary.append(
                    {
                        "column": column,
                        "count": outlier_info["outlier_count"],
                        "percentage": outlier_info["outlier_percentage"],
                        "lower_bound": outlier_info["lower_bound"],
                        "upper_bound": outlier_info["upper_bound"],
                    }
                )

        column_quality.append(
            {
                "name": column,
                "data_type": str(series.dtype),
                "missing_count": missing_count,
                "missing_percentage": col_missing_pct,
                "unique_count": unique_count,
                "is_constant": column in constant_columns,
                "is_empty": column in empty_columns,
                "is_id_candidate": is_id,
                "is_high_cardinality": is_high_cardinality,
                "outliers": outlier_info,
            }
        )

    # Calculate overall Health Score (0 - 100)
    health_score = 100.0
    health_score -= min(35.0, missing_percentage * 1.5)
    health_score -= min(20.0, duplicate_percentage * 2.0)
    health_score -= min(15.0, len(empty_columns) * 10.0)
    health_score -= min(15.0, len(constant_columns) * 5.0)

    total_outliers = sum(o["count"] for o in outlier_summary)
    if total_cells > 0:
        outlier_cell_pct = total_outliers / total_cells * 100
        health_score -= min(15.0, outlier_cell_pct * 3.0)

    health_score = max(0.0, min(100.0, round(health_score, 1)))

    if health_score >= 85:
        health_status = "Excellent"
    elif health_score >= 70:
        health_status = "Good"
    elif health_score >= 50:
        health_status = "Fair"
    else:
        health_status = "Poor"

    return {
        "row_count": total_rows,
        "column_count": total_cols,
        "total_cells": total_cells,
        "missing_cells": missing_cells,
        "missing_percentage": missing_percentage,
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "empty_columns": empty_columns,
        "constant_columns": constant_columns,
        "id_columns": id_columns,
        "high_cardinality_columns": high_cardinality_columns,
        "outliers": outlier_summary,
        "health_score": health_score,
        "health_status": health_status,
        "columns": column_quality,
    }