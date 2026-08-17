import math
import sqlite3
import time
from typing import Any
import numpy as np
import pandas as pd
from app.sql.sql_validator import validate_sql


def _sanitize_val(val: Any) -> Any:
    """Ensure values are JSON-serializable."""
    if val is None:
        return None
    if isinstance(val, (int, bool, str)):
        return val
    if isinstance(val, float):
        return None if (math.isnan(val) or math.isinf(val)) else round(val, 4)
    if isinstance(val, (np.integer, np.floating)):
        return _sanitize_val(val.item())
    return str(val)


def get_dataset_schema(file_path: str) -> dict[str, Any]:
    """Extract table schema, types, and sample rows for SQL generation."""
    df = pd.read_csv(file_path, nrows=50)

    # Total row count
    with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
        total_rows = max(0, sum(1 for _ in f) - 1)

    columns = []
    for col in df.columns:
        series = df[col]
        dtype = str(series.dtype)
        if "int" in dtype:
            sql_type = "INTEGER"
        elif "float" in dtype:
            sql_type = "REAL"
        elif "datetime" in dtype:
            sql_type = "DATETIME"
        elif "bool" in dtype:
            sql_type = "BOOLEAN"
        else:
            sql_type = "TEXT"

        sample_vals = [_sanitize_val(v) for v in series.dropna().unique()[:5]]

        columns.append(
            {
                "name": str(col),
                "data_type": sql_type,
                "pandas_dtype": dtype,
                "sample_values": sample_vals,
            }
        )

    # First 3 sample rows as dictionaries
    sample_rows = df.head(3).to_dict(orient="records")
    clean_sample_rows = [
        {k: _sanitize_val(v) for k, v in row.items()}
        for row in sample_rows
    ]

    return {
        "table_name": "dataset",
        "total_rows": total_rows,
        "column_count": len(df.columns),
        "columns": columns,
        "sample_rows": clean_sample_rows,
    }


def execute_sql_query(file_path: str, sql_query: str) -> dict[str, Any]:
    """
    Safely execute a validated SQL query against the CSV dataset.
    Scans 100% of the dataset records and returns query execution metrics,
    column descriptors, and row records.
    """
    validated_sql = validate_sql(sql_query)

    df = pd.read_csv(file_path)
    total_dataset_rows = len(df)

    upper_sql = validated_sql.upper()
    is_aggregate = any(
        agg in upper_sql for agg in ("COUNT(", "SUM(", "AVG(", "MIN(", "MAX(", "GROUP BY")
    )

    # Create isolated in-memory SQLite connection
    conn = sqlite3.connect(":memory:")
    try:
        # Load full dataset into in-memory SQLite table
        df.to_sql("dataset", conn, if_exists="replace", index=False)

        start_time = time.perf_counter()
        cursor = conn.cursor()
        cursor.execute(validated_sql)
        raw_rows = cursor.fetchall()
        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        column_names = [desc[0] for desc in cursor.description] if cursor.description else []

        # Convert rows to dictionaries
        formatted_rows = [
            {column_names[i]: _sanitize_val(val) for i, val in enumerate(row)}
            for row in raw_rows
        ]

        return {
            "sql": validated_sql,
            "columns": column_names,
            "rows": formatted_rows,
            "row_count": len(formatted_rows),
            "total_dataset_rows": total_dataset_rows,
            "scanned_percentage": 100.0,
            "is_aggregate": is_aggregate,
            "execution_time_ms": execution_time_ms,
        }

    except sqlite3.OperationalError as exc:
        raise ValueError(f"SQL execution error: {str(exc)}") from exc
    except sqlite3.DatabaseError as exc:
        raise ValueError(f"Database error: {str(exc)}") from exc
    finally:
        conn.close()
