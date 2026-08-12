import re
from typing import Any

try:
    from google import genai
except (ImportError, AttributeError):
    genai = None

from app.config import settings
from app.sql.sql_validator import clean_sql, validate_sql

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
]


def _call_gemini(prompt: str) -> str | None:
    """Helper to query Gemini with model fallback."""
    if not settings.gemini_api_key or settings.gemini_api_key.startswith("your_") or genai is None:
        return None

    client = genai.Client(api_key=settings.gemini_api_key)
    candidate_models = [settings.gemini_model] + [
        m for m in FALLBACK_MODELS if m != settings.gemini_model
    ]

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                return response.text.strip()
        except Exception as exc:
            print(f"[SQL Generator] Model {model_name} failed: {str(exc)[:120]}")
            continue
    return None


def generate_suggested_questions(schema: dict[str, Any]) -> list[str]:
    """Generate smart starter questions tailored to the dataset schema."""
    columns = schema.get("columns", [])
    num_cols = [c["name"] for c in columns if c["data_type"] in ("INTEGER", "REAL")]
    cat_cols = [c["name"] for c in columns if c["data_type"] == "TEXT"]
    date_cols = [c["name"] for c in columns if c["data_type"] == "DATETIME"]

    suggestions = []

    if num_cols and cat_cols:
        suggestions.append(f"Which {cat_cols[0]} has the highest total {num_cols[0]}?")
        suggestions.append(f"Show average {num_cols[0]} grouped by {cat_cols[0]}")
    elif num_cols:
        suggestions.append(f"Show top 10 records with highest {num_cols[0]}")
        suggestions.append(f"What is the average and max {num_cols[0]}?")

    if cat_cols:
        suggestions.append(f"How many records are there for each {cat_cols[0]}?")

    if date_cols and num_cols:
        suggestions.append(f"Show total {num_cols[0]} trend over {date_cols[0]}")

    if len(suggestions) < 4:
        suggestions.append("Show the first 10 rows of the dataset")
        suggestions.append("Count total number of rows")

    return suggestions[:5]


def _rule_based_sql_fallback(question: str, schema: dict[str, Any]) -> str:
    """Deterministic fallback for common natural language queries when LLM is unavailable."""
    q_lower = question.lower()
    columns = [c["name"] for c in schema.get("columns", [])]
    num_cols = [c["name"] for c in schema.get("columns", []) if c["data_type"] in ("INTEGER", "REAL")]
    cat_cols = [c["name"] for c in schema.get("columns", []) if c["data_type"] == "TEXT"]

    # Match target numeric column
    target_num = next((col for col in num_cols if col.lower() in q_lower), num_cols[0] if num_cols else None)
    target_cat = next((col for col in cat_cols if col.lower() in q_lower), cat_cols[0] if cat_cols else None)

    if "count" in q_lower or "how many" in q_lower:
        if target_cat:
            return f'SELECT "{target_cat}", COUNT(*) as count FROM dataset GROUP BY "{target_cat}" ORDER BY count DESC LIMIT 20'
        return "SELECT COUNT(*) as total_rows FROM dataset"

    if ("highest" in q_lower or "top" in q_lower or "max" in q_lower) and target_num:
        if target_cat:
            return f'SELECT "{target_cat}", SUM("{target_num}") as total_{target_num} FROM dataset GROUP BY "{target_cat}" ORDER BY total_{target_num} DESC LIMIT 10'
        return f'SELECT * FROM dataset ORDER BY "{target_num}" DESC LIMIT 10'

    if ("average" in q_lower or "avg" in q_lower or "mean" in q_lower) and target_num:
        if target_cat:
            return f'SELECT "{target_cat}", AVG("{target_num}") as avg_{target_num} FROM dataset GROUP BY "{target_cat}" ORDER BY avg_{target_num} DESC LIMIT 20'
        return f'SELECT AVG("{target_num}") as avg_{target_num} FROM dataset'

    return "SELECT * FROM dataset LIMIT 25"


def generate_sql_from_nl(question: str, schema: dict[str, Any]) -> str:
    """
    Translate natural language question into safe, ANSI-compatible SQL for table `dataset`.
    """
    columns_desc = "\n".join(
        [
            f'  - "{c["name"]}" ({c["data_type"]}): sample values {c.get("sample_values", [])[:3]}'
            for c in schema.get("columns", [])
        ]
    )

    prompt = f"""
You are an expert SQL engineer. Generate a single SQLite-compatible SELECT query for table `dataset`.

TABLE SCHEMA:
Table: dataset
Columns:
{columns_desc}

SAMPLE ROWS:
{schema.get("sample_rows", [])}

USER QUESTION:
"{question}"

RULES:
1. Return ONLY the raw SQL query. Do not wrap in markdown or add explanations.
2. Only write read-only SELECT queries (CTEs with WITH are allowed).
3. Always enclose column names in double quotes if they contain spaces or special characters: e.g. "Product Name", "Sales".
4. Use standard SQL functions (SUM, AVG, COUNT, MIN, MAX, ROUND, strftime for dates).
5. Always order results logically when answering top/bottom/highest/lowest queries.
6. Do not include semicolons at the end.
"""

    llm_output = _call_gemini(prompt)
    if llm_output:
        cleaned = clean_sql(llm_output)
        # Remove any lingering markdown
        cleaned = re.sub(r"^SQL\s*:\s*", "", cleaned, flags=re.IGNORECASE)
        try:
            return validate_sql(cleaned)
        except Exception:
            pass

    # Use fallback
    return _rule_based_sql_fallback(question, schema)


def explain_query_result(question: str, sql: str, result: dict[str, Any]) -> str:
    """
    Generate a concise, grounded explanation of what the query computed and its answer.
    """
    rows = result.get("rows", [])
    row_count = result.get("row_count", 0)

    if row_count == 0:
        return "The query executed successfully but found no records matching your criteria."

    # First 5 rows as context
    sample_context = rows[:5]

    prompt = f"""
You are a senior data analyst. Answer the user's question concisely based STRICTLY on the SQL execution results below.

USER QUESTION:
"{question}"

SQL EXECUTED:
{sql}

QUERY RESULT ({row_count} total rows returned):
{sample_context}

RULES:
1. Provide a direct, 2-3 sentence grounded answer.
2. Quote exact numbers and values from the query result. Do not hallucinate.
3. Be clear, professional, and highlight the key takeaway.
"""

    explanation = _call_gemini(prompt)
    if explanation:
        return explanation.strip()

    # Rule-based fallback explanation
    first_row = rows[0]
    items_summary = ", ".join([f"{k}: {v}" for k, v in list(first_row.items())[:3]])
    return (
        f"Query executed in {result.get('execution_time_ms', 0)}ms and returned {row_count} row(s). "
        f"Top result: ({items_summary})."
    )
