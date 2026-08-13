import math
from typing import Any
import numpy as np
import pandas as pd
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
)

MAX_CATEGORIES = 10
DEFAULT_BINS = 8


def _is_year_column(name: str) -> bool:
    """Check if a column name indicates a year attribute."""
    n = str(name).lower()
    return "year" in n or "yr" in n


def _format_number(value: Any, is_year: bool = False) -> str:
    """Convert numeric values into clean, human-readable labels."""
    if value is None:
        return ""

    try:
        num = float(value)
    except (TypeError, ValueError):
        return str(value)

    if math.isnan(num) or math.isinf(num):
        return str(value)

    if num.is_integer():
        val_int = int(num)
        if is_year or (1900 <= val_int <= 2100):
            return str(val_int)
        return f"{val_int:,}"

    if is_year or (1900 <= num <= 2100):
        return f"{num:.1f}"

    if abs(num) >= 1_000_000:
        return f"{num:,.2f}"
    elif abs(num) >= 1_000:
        return f"{num:,.1f}".rstrip("0").rstrip(".")
    elif abs(num) < 0.01 and num != 0:
        return f"{num:.4f}".rstrip("0").rstrip(".")
    else:
        formatted = f"{num:.2f}"
        return formatted.rstrip("0").rstrip(".")


def _clean_category(value: Any) -> str:
    """Make categorical values safe and readable for JSON/frontend use."""
    if pd.isna(value):
        return "Missing"

    if isinstance(value, float) and value.is_integer():
        return str(int(value))

    val_str = str(value).strip()
    return val_str if val_str else "Empty"


def _generate_numeric_histogram(series: pd.Series, bins: int = DEFAULT_BINS) -> list[dict[str, Any]]:
    """
    Generate a clean, robust histogram for a numeric column.
    For discrete integer attributes (like years, rating tiers, small counts),
    generates exact discrete value bars rather than confusing fractional ranges.
    """
    numeric = pd.to_numeric(series, errors="coerce").dropna()

    if numeric.empty:
        return []

    total_count = len(numeric)
    minimum = float(numeric.min())
    maximum = float(numeric.max())
    is_year = _is_year_column(series.name)

    if minimum == maximum:
        label = _format_number(minimum, is_year=is_year)
        return [
            {
                "min": minimum,
                "max": maximum,
                "label": label,
                "value": label,
                "range": label,
                "count": total_count,
                "percentage": 100.0,
            }
        ]

    n_unique = int(numeric.nunique())
    is_all_int = bool((numeric == numeric.round()).all())

    # If discrete integers with <= 14 unique values (e.g. JoiningYear, PaymentTier, LeaveOrNot, Rating)
    if is_all_int and n_unique <= 14:
        counts = numeric.astype(int).value_counts().sort_index()
        return [
            {
                "min": float(val),
                "max": float(val),
                "label": str(val) if is_year or (1900 <= val <= 2100) else (f"{val:,}" if abs(val) >= 10000 else str(val)),
                "value": str(val) if is_year or (1900 <= val <= 2100) else (f"{val:,}" if abs(val) >= 10000 else str(val)),
                "range": str(val),
                "count": int(cnt),
                "percentage": round((int(cnt) / total_count * 100), 1) if total_count > 0 else 0.0,
            }
            for val, cnt in counts.items()
        ]

    actual_bins = min(bins, max(2, min(n_unique, 8)))

    # For continuous integer columns (like Age 22-41), create integer bounds
    if is_all_int:
        raw_edges = np.linspace(minimum, maximum, actual_bins + 1)
        edges = np.unique(np.round(raw_edges).astype(int))
        if len(edges) < 2:
            edges = np.array([int(minimum), int(maximum) + 1])
    else:
        edges = np.linspace(minimum, maximum, actual_bins + 1)

    try:
        counts, bin_edges = pd.cut(
            numeric,
            bins=edges,
            include_lowest=True,
            right=True,
            labels=False,
            retbins=True,
        )

        histogram = []
        for index in range(len(bin_edges) - 1):
            lower = float(bin_edges[index])
            upper = float(bin_edges[index + 1])
            count = int((counts == index).sum())
            percentage = round((count / total_count * 100), 1) if total_count > 0 else 0.0

            if is_all_int:
                lower_str = str(int(lower)) if is_year else f"{int(lower):,}"
                upper_str = str(int(upper)) if is_year else f"{int(upper):,}"
                range_label = f"{lower_str} – {upper_str}" if lower != upper else lower_str
            else:
                range_label = f"{_format_number(lower, is_year)} – {_format_number(upper, is_year)}"

            histogram.append(
                {
                    "min": lower,
                    "max": upper,
                    "label": range_label,
                    "value": range_label,
                    "range": range_label,
                    "count": count,
                    "percentage": percentage,
                }
            )
        return histogram

    except Exception:
        label = f"{_format_number(minimum, is_year)} – {_format_number(maximum, is_year)}"
        return [
            {
                "min": minimum,
                "max": maximum,
                "label": label,
                "value": label,
                "range": label,
                "count": total_count,
                "percentage": 100.0,
            }
        ]


def _generate_categorical_frequency(series: pd.Series, max_categories: int = MAX_CATEGORIES) -> list[dict[str, Any]]:
    """Generate top-frequency values for categorical columns."""
    cleaned = series.dropna()

    if cleaned.empty:
        return []

    total_count = len(cleaned)
    value_counts = cleaned.map(_clean_category).value_counts()
    top_counts = value_counts.head(max_categories)

    data = []
    accounted_count = 0
    for value, count in top_counts.items():
        count_int = int(count)
        accounted_count += count_int
        percentage = round((count_int / total_count * 100), 1) if total_count > 0 else 0.0
        data.append(
            {
                "value": str(value),
                "label": str(value),
                "count": count_int,
                "percentage": percentage,
            }
        )

    remaining = total_count - accounted_count
    if remaining > 0 and len(value_counts) > max_categories:
        data.append(
            {
                "value": "Other",
                "label": f"Other ({len(value_counts) - max_categories} values)",
                "count": int(remaining),
                "percentage": round((remaining / total_count * 100), 1),
            }
        )

    return data


def _try_parse_datetime(series: pd.Series) -> pd.Series | None:
    """Attempt to detect and parse datetime columns safely."""
    if is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors="coerce")

    # If object or string dtype, test a sample
    if series.dtype == object or str(series.dtype) == "string":
        sample = series.dropna().head(50)
        if sample.empty:
            return None

        # Ignore if all samples are pure numbers (likely IDs or codes)
        if all(str(s).strip().isdigit() for s in sample):
            return None

        try:
            parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
            valid_ratio = parsed.notna().mean()
            if valid_ratio >= 0.8:
                return pd.to_datetime(series, errors="coerce", format="mixed")
        except Exception:
            return None

    return None


def _generate_datetime_distribution(dates: pd.Series) -> list[dict[str, Any]]:
    """Generate chronological frequency distribution for datetime data."""
    valid_dates = dates.dropna()
    if valid_dates.empty:
        return []

    total_count = len(valid_dates)
    min_date = valid_dates.min()
    max_date = valid_dates.max()
    span_days = (max_date - min_date).days if pd.notna(min_date) and pd.notna(max_date) else 0

    if span_days > 730:
        period = "Y"
    elif span_days > 60:
        period = "M"
    else:
        period = "D"

    frequency = (
        valid_dates.dt.to_period(period)
        .astype(str)
        .value_counts()
        .sort_index()
        .tail(MAX_CATEGORIES)
    )

    return [
        {
            "value": str(period_val),
            "label": str(period_val),
            "count": int(count),
            "percentage": round((int(count) / total_count * 100), 1) if total_count > 0 else 0.0,
        }
        for period_val, count in frequency.items()
    ]


def classify_correlation(corr_val: float) -> tuple[str, str, str]:
    """
    Classify correlation value according to the standard 5-tier scale:
    0.80–1.00: Very Strong
    0.60–0.79: Strong
    0.40–0.59: Moderate
    0.20–0.39: Weak
    0.00–0.19: Very Weak
    """
    abs_v = round(abs(corr_val), 4)
    direction = "Positive" if corr_val >= 0 else "Negative"

    if abs_v >= 0.80:
        tier = "Very Strong"
    elif abs_v >= 0.60:
        tier = "Strong"
    elif abs_v >= 0.40:
        tier = "Moderate"
    elif abs_v >= 0.20:
        tier = "Weak"
    else:
        tier = "Very Weak"

    full_label = f"{tier} {direction}"
    return full_label, direction, tier


def _generate_correlation_data(df: pd.DataFrame) -> dict[str, Any]:
    """
    Calculate dataset-adaptive Pearson correlation matrix and top correlated pairs.
    - Excludes constant columns (zero variance)
    - Excludes candidate sequential/identifier columns
    - Handles missing values gracefully via pairwise complete observations
    - Ranks by absolute correlation strength
    - Applies 5-tier classification scale
    """
    total_rows = len(df)
    numeric_df = df.select_dtypes(include=[np.number])

    # Filter out columns with <= 1 unique value or potential unique integer IDs
    valid_cols = []
    for col in numeric_df.columns:
        series = numeric_df[col].dropna()
        n_unique = int(series.nunique())
        if n_unique <= 1:
            continue

        # Exclude sequential index IDs like 'id', 'row_id', 'index' if 100% unique
        col_lower = str(col).lower()
        if (col_lower in ("id", "row_id", "index", "record_id", "unnamed: 0") or col_lower.endswith("_id")) and n_unique == total_rows:
            continue

        valid_cols.append(col)

    if len(valid_cols) < 2:
        return {
            "columns": valid_cols,
            "matrix": [],
            "top_correlations": [],
            "numeric_column_count": len(valid_cols),
            "message": "At least two suitable numeric columns are required to calculate correlations." if len(valid_cols) < 2 else "Ready",
        }

    # Pairwise correlation calculation for maximum resilience against missing values
    matrix_data = []
    pairs = []

    for i in range(len(valid_cols)):
        col1 = valid_cols[i]
        row_vals = {}

        for j in range(len(valid_cols)):
            col2 = valid_cols[j]
            if col1 == col2:
                row_vals[col2] = 1.0
            else:
                # Pairwise complete rows
                aligned = df[[col1, col2]].dropna()
                if len(aligned) >= 3:
                    try:
                        c_val = aligned[col1].corr(aligned[col2], method="pearson")
                        if pd.notna(c_val) and not np.isinf(c_val):
                            row_vals[col2] = round(float(c_val), 3)
                        else:
                            row_vals[col2] = 0.0
                    except Exception:
                        row_vals[col2] = 0.0
                else:
                    row_vals[col2] = 0.0

            # Collect unique non-self pairs (i < j)
            if i < j:
                c_float = row_vals[col2]
                if pd.notna(c_float) and not np.isinf(c_float):
                    strength_label, direction, tier = classify_correlation(c_float)
                    pairs.append(
                        {
                            "column1": col1,
                            "column2": col2,
                            "feature_a": col1,
                            "feature_b": col2,
                            "correlation": float(c_float),
                            "abs_correlation": abs(float(c_float)),
                            "strength": strength_label,
                            "direction": direction,
                            "tier": tier,
                        }
                    )

        matrix_data.append({"column": col1, "values": row_vals})

    # Rank correlations by absolute strength descending
    pairs.sort(key=lambda x: x["abs_correlation"], reverse=True)

    # Filter out near-zero correlations if there are enough stronger relationships
    meaningful_pairs = [p for p in pairs if p["abs_correlation"] >= 0.05]
    display_pairs = meaningful_pairs if len(meaningful_pairs) >= 3 else pairs

    top_pairs = [
        {
            "column1": p["column1"],
            "column2": p["column2"],
            "feature_a": p["feature_a"],
            "feature_b": p["feature_b"],
            "correlation": p["correlation"],
            "strength": p["strength"],
            "direction": p["direction"],
            "tier": p["tier"],
        }
        for p in display_pairs[:12]
    ]

    return {
        "columns": valid_cols,
        "matrix": matrix_data,
        "top_correlations": top_pairs,
        "numeric_column_count": len(valid_cols),
        "total_pairs_evaluated": len(pairs),
    }


def generate_visualization_data(file_path: str) -> dict[str, Any]:
    """Generate robust frontend-friendly visualization & correlation data."""
    df = pd.read_csv(file_path)

    visualizations = []

    for column in df.columns:
        series = df[column]

        # 1. Datetime
        dt_series = _try_parse_datetime(series)
        if dt_series is not None:
            data = _generate_datetime_distribution(dt_series)
            if data:
                visualizations.append(
                    {
                        "column": column,
                        "type": "time",
                        "data": data,
                    }
                )
                continue

        # 2. Numeric
        if is_numeric_dtype(series) and not is_bool_dtype(series):
            data = _generate_numeric_histogram(series)
            if data:
                visualizations.append(
                    {
                        "column": column,
                        "type": "histogram",
                        "data": data,
                    }
                )
                continue

        # 3. Categorical / Object / Boolean
        data = _generate_categorical_frequency(series)
        if data:
            visualizations.append(
                {
                    "column": column,
                    "type": "frequency",
                    "data": data,
                }
            )

    correlations = _generate_correlation_data(df)

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "visualizations": visualizations,
        "correlations": correlations,
    }