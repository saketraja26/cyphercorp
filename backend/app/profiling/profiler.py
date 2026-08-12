import math
from typing import Any
import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except (TypeError, ValueError):
        return None


def profile_csv(file_path: str) -> dict[str, Any]:
    """
    Analyze a CSV dataset and return core profiling information.
    Guarantees safety against empty, single-row, or all-null datasets.
    """
    df = pd.read_csv(file_path)

    row_count = int(df.shape[0])
    column_count = int(df.shape[1])

    # Memory usage in KB
    try:
        memory_usage_kb = round(df.memory_usage(deep=True).sum() / 1024, 2)
    except Exception:
        memory_usage_kb = 0.0

    columns = []
    missing_values = {}

    for column in df.columns:
        series = df[column]
        missing_count = int(series.isna().sum())
        unique_count = int(series.nunique(dropna=True))
        missing_pct = round(missing_count / row_count * 100, 2) if row_count > 0 else 0.0

        columns.append(
            {
                "name": str(column),
                "data_type": str(series.dtype),
                "missing_values": missing_count,
                "missing_percentage": missing_pct,
                "unique_values": unique_count,
            }
        )

        if missing_count > 0:
            missing_values[str(column)] = missing_count

    numeric_statistics = {}
    for column in df.columns:
        series = df[column]
        if is_numeric_dtype(series) and not is_bool_dtype(series):
            clean_num = pd.to_numeric(series, errors="coerce").dropna()
            if not clean_num.empty:
                numeric_statistics[str(column)] = {
                    "min": _safe_float(clean_num.min()),
                    "max": _safe_float(clean_num.max()),
                    "mean": _safe_float(clean_num.mean()),
                    "median": _safe_float(clean_num.median()),
                }

    return {
        "row_count": row_count,
        "column_count": column_count,
        "memory_usage_kb": memory_usage_kb,
        "columns": columns,
        "missing_values": missing_values,
        "numeric_statistics": numeric_statistics,
    }