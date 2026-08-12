from typing import Any


def generate_insights(
    statistics: dict[str, Any],
    quality: dict[str, Any],
    correlations: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Generate rich, actionable rule-based insights and anomalies from dataset statistics,
    quality metrics, and correlations.
    """
    insights: list[dict[str, Any]] = []

    row_count = statistics.get("row_count", 0)
    column_count = statistics.get("column_count", 0)
    health_score = quality.get("health_score", 100.0)
    health_status = quality.get("health_status", "Good")

    # 1. Dataset Overview & Health Score
    insights.append(
        {
            "type": "overview",
            "severity": "info",
            "title": "Dataset Overview",
            "message": (
                f"The dataset contains {row_count:,} rows and {column_count} columns with an "
                f"overall Data Health Score of {health_score}/100 ({health_status})."
            ),
        }
    )

    # 2. Missing Values Insights
    missing_percentage = quality.get("missing_percentage", 0.0)
    missing_cells = quality.get("missing_cells", 0)

    if missing_percentage > 20:
        insights.append(
            {
                "type": "missing_values",
                "severity": "high",
                "title": "Severe Missing Data",
                "message": (
                    f"{missing_percentage:.1f}% ({missing_cells:,} cells) of the dataset is missing. "
                    "Data imputation or row/column pruning is strongly advised."
                ),
            }
        )
    elif missing_percentage > 5:
        insights.append(
            {
                "type": "missing_values",
                "severity": "medium",
                "title": "Moderate Missing Data",
                "message": f"{missing_percentage:.1f}% ({missing_cells:,} cells) of dataset entries are missing.",
            }
        )
    elif missing_percentage == 0:
        insights.append(
            {
                "type": "data_integrity",
                "severity": "info",
                "title": "Zero Missing Data",
                "message": "The dataset is complete with 0% missing cells across all columns.",
            }
        )

    # 3. Duplicate Rows
    duplicate_rows = quality.get("duplicate_rows", 0)
    duplicate_percentage = quality.get("duplicate_percentage", 0.0)

    if duplicate_rows > 0:
        severity = "high" if duplicate_percentage > 10 else "medium"
        insights.append(
            {
                "type": "duplicates",
                "severity": severity,
                "title": "Duplicate Records Detected",
                "message": (
                    f"{duplicate_rows:,} duplicate rows detected ({duplicate_percentage:.1f}% of dataset). "
                    "Consider deduplicating records before training models."
                ),
            }
        )

    # 4. Outlier Detection Insights
    outliers = quality.get("outliers", [])
    if outliers:
        for out in outliers[:3]:
            col = out.get("column", "")
            cnt = out.get("count", 0)
            pct = out.get("percentage", 0.0)
            severity = "high" if pct > 10 else "medium"
            insights.append(
                {
                    "type": "outliers",
                    "severity": severity,
                    "title": f"Outliers in '{col}'",
                    "message": (
                        f"Column '{col}' contains {cnt:,} outliers ({pct:.1f}% of values) based on IQR bounds "
                        f"[{out.get('lower_bound')}, {out.get('upper_bound')}]."
                    ),
                    "column": col,
                }
            )

    # 5. Correlation Insights
    top_corrs = []
    if correlations and isinstance(correlations, dict):
        top_corrs = correlations.get("top_correlations", [])
    for corr in top_corrs:
        c_val = corr.get("correlation", 0.0)
        c1 = corr.get("column1", "")
        c2 = corr.get("column2", "")
        if abs(c_val) >= 0.7:
            direction = "positive" if c_val > 0 else "negative"
            insights.append(
                {
                    "type": "correlation",
                    "severity": "info",
                    "title": f"Strong Correlation ({c1} & {c2})",
                    "message": f"Strong {direction} correlation ({c_val:+.2f}) detected between '{c1}' and '{c2}'.",
                    "columns": [c1, c2],
                }
            )

    # 6. Distribution & Skewness Insights
    for col_info in statistics.get("columns", []):
        stats = col_info.get("statistics")
        if stats and stats.get("skewness") is not None:
            skew = stats["skewness"]
            col_name = col_info.get("name", "")
            if skew > 1.5:
                insights.append(
                    {
                        "type": "distribution",
                        "severity": "low",
                        "title": f"Right-Skewed Distribution ('{col_name}')",
                        "message": f"Column '{col_name}' is strongly right-skewed (skewness: {skew:+.2f}). Log transformation may be beneficial for linear models.",
                        "column": col_name,
                    }
                )
            elif skew < -1.5:
                insights.append(
                    {
                        "type": "distribution",
                        "severity": "low",
                        "title": f"Left-Skewed Distribution ('{col_name}')",
                        "message": f"Column '{col_name}' is strongly left-skewed (skewness: {skew:+.2f}).",
                        "column": col_name,
                    }
                )

    # 7. Structural Flags: Empty, Constant, ID Candidates
    empty_cols = quality.get("empty_columns", [])
    if empty_cols:
        insights.append(
            {
                "type": "empty_columns",
                "severity": "high",
                "title": "Empty Columns",
                "message": f"{len(empty_cols)} completely empty column(s) detected: {', '.join(empty_cols)}. These should be dropped.",
                "columns": empty_cols,
            }
        )

    constant_cols = quality.get("constant_columns", [])
    if constant_cols:
        insights.append(
            {
                "type": "constant_columns",
                "severity": "medium",
                "title": "Zero-Variance Columns",
                "message": f"{len(constant_cols)} constant column(s) with zero variance detected: {', '.join(constant_cols)}. These provide no predictive signal.",
                "columns": constant_cols,
            }
        )

    id_cols = quality.get("id_columns", [])
    if id_cols:
        insights.append(
            {
                "type": "identifier",
                "severity": "info",
                "title": "Potential Primary Key / ID Columns",
                "message": f"Column(s) {', '.join(id_cols)} have 100% unique values and appear to be unique identifiers.",
                "columns": id_cols,
            }
        )

    return insights