import re
from typing import Any

try:
    from google import genai
except (ImportError, AttributeError):
    genai = None

try:
    from openai import OpenAI
except (ImportError, AttributeError):
    OpenAI = None

from app.config import settings
from app.sql.sql_validator import clean_sql, validate_sql

CANDIDATE_MODELS = [
    settings.gemini_model,
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
]


def _get_admin_provider_preference() -> tuple[str, str]:
    """
    Synchronously read the admin-configured provider/model from the DB.
    Returns (active_provider, active_model). Defaults to ("auto", "").
    """
    try:
        from sqlalchemy import create_engine, select as sa_select
        from app.config import settings as app_settings
        from app.models.admin_settings import AdminSettings

        db_url = app_settings.database_url
        if "aiosqlite" in db_url:
            db_url = db_url.replace("+aiosqlite", "")
        elif "asyncpg" in db_url:
            db_url = db_url.replace("+asyncpg", "+psycopg2")

        sync_engine = create_engine(db_url, echo=False)
        from sqlalchemy.orm import Session
        with Session(sync_engine) as session:
            row = session.execute(
                sa_select(AdminSettings).where(AdminSettings.id == 1)
            ).scalar_one_or_none()
            if row:
                return (row.active_provider, row.active_model)
        sync_engine.dispose()
    except Exception as exc:
        print(f"[AdminSettings SQL] Could not read preference: {exc}")

    return ("auto", "")


def _call_llm(prompt: str) -> str | None:
    """Helper to query OpenAI or Gemini respecting admin-selected provider preference."""
    admin_provider, admin_model = _get_admin_provider_preference()

    def _try_openai(model_override: str = "") -> str | None:
        if not settings.openai_api_key or settings.openai_api_key.startswith("your_"):
            return None
        try:
            client = OpenAI(api_key=settings.openai_api_key)
            model_name = model_override or settings.openai_model or "gpt-4.1-mini"
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a principal database engineer and data analyst.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
            )
            if completion.choices and completion.choices[0].message.content:
                return completion.choices[0].message.content.strip()
        except Exception as exc:
            print(f"[OpenAI SQL Warning] Error: {str(exc)[:150]}")
        return None

    def _try_gemini(model_override: str = "") -> str | None:
        if not settings.gemini_api_key or settings.gemini_api_key.startswith("your_") or genai is None:
            return None
        client = genai.Client(api_key=settings.gemini_api_key)
        models_to_try = []
        if model_override:
            models_to_try.append(model_override)
        for m in CANDIDATE_MODELS:
            if m and m not in models_to_try:
                models_to_try.append(m)

        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception:
                continue
        return None

    # Dispatch based on admin preference
    if admin_provider == "openai":
        return _try_openai(admin_model) or _try_gemini()
    elif admin_provider == "gemini":
        return _try_gemini(admin_model) or _try_openai()
    else:
        # auto: try OpenAI first, then Gemini
        return _try_openai() or _try_gemini()


_call_gemini = _call_llm


def get_active_ai_provider() -> dict[str, str]:
    """Return the active AI provider and model name based on admin settings."""
    admin_provider, admin_model = _get_admin_provider_preference()

    if admin_provider == "openai" and settings.openai_api_key and not settings.openai_api_key.startswith("your_"):
        return {"provider": "OpenAI", "model": admin_model or settings.openai_model or "gpt-4.1-mini"}
    elif admin_provider == "gemini" and settings.gemini_api_key and not settings.gemini_api_key.startswith("your_"):
        return {"provider": "Gemini", "model": admin_model or settings.gemini_model}
    elif admin_provider == "auto":
        if settings.openai_api_key and not settings.openai_api_key.startswith("your_"):
            return {"provider": "OpenAI", "model": settings.openai_model or "gpt-4.1-mini"}
        if settings.gemini_api_key and not settings.gemini_api_key.startswith("your_"):
            return {"provider": "Gemini", "model": settings.gemini_model}
    return {"provider": "Rule-Based", "model": "Deterministic Engine"}


def _is_id_column(col_name: str) -> bool:
    """Check if a column is an ID or identifier rather than a measurable numeric quantity."""
    c = str(col_name).strip().lower()
    if c in ("id", "index", "uuid", "guid", "row_id", "row_number", "key", "code", "no", "num"):
        return True
    if re.search(r"(?:^|[_\s])(id|uuid|guid|key|code|index|no|num)$", c):
        return True
    if c.endswith("id") and len(c) > 2:
        return True
    return False


def _categorize_columns(schema: dict[str, Any]):
    """Partition schema columns into ID, numerical measures, categoricals, and dates."""
    columns = schema.get("columns", [])
    id_cols = [c["name"] for c in columns if _is_id_column(c["name"])]
    num_cols = [
        c["name"]
        for c in columns
        if c["data_type"] in ("INTEGER", "REAL") and not _is_id_column(c["name"])
    ]
    cat_cols = [
        c["name"]
        for c in columns
        if c["data_type"] == "TEXT" and not _is_id_column(c["name"])
    ]
    date_cols = [c["name"] for c in columns if c["data_type"] == "DATETIME"]
    return id_cols, num_cols, cat_cols, date_cols


def generate_suggested_questions(schema: dict[str, Any]) -> list[str]:
    """Generate smart, semantically correct starter questions tailored to the dataset schema."""
    id_cols, num_cols, cat_cols, date_cols = _categorize_columns(schema)
    suggestions = []

    # 1. Identifier / record counts by category
    if cat_cols and id_cols:
        suggestions.append(f"Which {cat_cols[0]} has the highest number of {id_cols[0]}?")
        suggestions.append(f"How many records are there for each {cat_cols[0]}?")
    elif cat_cols:
        suggestions.append(f"How many records are there for each {cat_cols[0]}?")

    # 2. Measurable numeric aggregations (SUM / AVG)
    if num_cols and cat_cols:
        suggestions.append(f"Which {cat_cols[0]} has the highest total {num_cols[0]}?")
        suggestions.append(f"Show average {num_cols[0]} grouped by {cat_cols[0]}")
    elif num_cols:
        suggestions.append(f"Show top 10 records with highest {num_cols[0]}")
        suggestions.append(f"What is the average and max {num_cols[0]}?")

    # 3. Time series trend
    if date_cols and num_cols:
        suggestions.append(f"Show total {num_cols[0]} trend over {date_cols[0]}")

    # 4. Standard exploration starters
    if len(suggestions) < 5:
        suggestions.append("Show the first 10 rows of the dataset")
        suggestions.append("Count total number of rows")

    return suggestions[:5]


def _rule_based_sql_fallback(question: str, schema: dict[str, Any]) -> str:
    """
    Deterministic semantic fallback for natural language queries when LLM is unavailable.
    Guarantees mathematically sound queries and strict limit enforcement.
    """
    q_lower = question.lower().strip()
    id_cols, num_cols, cat_cols, _ = _categorize_columns(schema)
    all_cols = [c["name"] for c in schema.get("columns", [])]

    # Extract user-requested limit (e.g. "first 10 rows", "top 5", "limit 20", "see 10")
    m_limit = re.search(
        r"\b(?:first|top|limit|sample|show|see|preview|head)?\s*(\d+)\s*(?:rows?|records?|items?|entries?)?\b",
        q_lower,
    )
    user_limit = int(m_limit.group(1)) if m_limit else None
    default_limit = user_limit if user_limit is not None else 10

    # 1. Row browsing / dataset preview requests ("see first 10 rows", "show 10 rows", "preview dataset")
    is_browse_query = bool(
        any(w in q_lower for w in ("first", "see", "show", "display", "preview", "browse", "sample", "head", "view"))
        and any(w in q_lower for w in ("row", "record", "data", "dataset", "table", "sample", "entries"))
        and not any(w in q_lower for w in ("count", "sum", "avg", "average", "group", "highest", "total", "which", "where"))
    )
    if is_browse_query:
        return f"SELECT * FROM dataset LIMIT {default_limit}"

    # Match target columns from question
    target_id = next((col for col in id_cols if col.lower() in q_lower), id_cols[0] if id_cols else None)
    target_measure = next((col for col in num_cols if col.lower() in q_lower), num_cols[0] if num_cols else None)
    target_cat = next((col for col in cat_cols if col.lower() in q_lower), cat_cols[0] if cat_cols else None)

    # 2. Total record count ("count total rows", "how many rows")
    if ("count" in q_lower or "how many" in q_lower or "total" in q_lower) and not target_cat:
        return "SELECT COUNT(*) as total_rows FROM dataset"

    # 3. Categorical counting / ID counts ("which gender has the highest number of customer id", "count by category")
    has_count_intent = bool(
        "count" in q_lower
        or "how many" in q_lower
        or "number of" in q_lower
        or "most" in q_lower
        or "highest number" in q_lower
        or (target_id and target_id.lower() in q_lower)
    )
    if target_cat and has_count_intent:
        return f'SELECT "{target_cat}", COUNT(*) as count FROM dataset GROUP BY "{target_cat}" ORDER BY count DESC LIMIT {default_limit}'

    # 4. Highest / Top / Max on quantitative measures (e.g. Salary, Balance)
    if ("highest" in q_lower or "top" in q_lower or "max" in q_lower or "total" in q_lower or "sum" in q_lower) and target_measure:
        if target_cat:
            return f'SELECT "{target_cat}", SUM("{target_measure}") as total_{target_measure} FROM dataset GROUP BY "{target_cat}" ORDER BY total_{target_measure} DESC LIMIT {default_limit}'
        return f'SELECT * FROM dataset ORDER BY "{target_measure}" DESC LIMIT {default_limit}'

    # 5. Average / Mean on quantitative measures
    if ("average" in q_lower or "avg" in q_lower or "mean" in q_lower) and target_measure:
        if target_cat:
            return f'SELECT "{target_cat}", ROUND(AVG("{target_measure}"), 2) as avg_{target_measure} FROM dataset GROUP BY "{target_cat}" ORDER BY avg_{target_measure} DESC LIMIT {default_limit}'
        return f'SELECT ROUND(AVG("{target_measure}"), 2) as avg_{target_measure} FROM dataset'

    # 6. Default safe query with strict limit
    return f"SELECT * FROM dataset LIMIT {default_limit}"


def generate_sql_from_nl(question: str, schema: dict[str, Any]) -> str:
    """
    Translate natural language question into safe, accurate ANSI-compatible SQL for SQLite table `dataset`.
    """
    columns_desc = "\n".join(
        [
            f'  - "{c["name"]}" ({c["data_type"]}): sample values {c.get("sample_values", [])[:3]}'
            for c in schema.get("columns", [])
        ]
    )

    prompt = f"""
You are an expert principal SQL engineer and data scientist. Generate a single SQLite-compatible SELECT query for table `dataset`.

TABLE SCHEMA:
Table: dataset
Columns:
{columns_desc}

SAMPLE ROWS:
{schema.get("sample_rows", [])}

USER QUESTION:
"{question}"

CRITICAL SQL GENERATION RULES:
1. IDENTIFIERS vs MEASURES (CRITICAL):
   - NEVER use SUM() or AVG() on ID/identifier columns (e.g. "CustomerID", "ID", "User_ID", "Order_ID", "account_id", code, index).
   - If the user asks for "number of customer ids", "count of customers", "how many IDs", "which category has highest customer IDs", or "number of records", use COUNT("CustomerID") or COUNT(*) with GROUP BY and ORDER BY count DESC.
   - Only use SUM() or AVG() on true quantitative metrics (e.g. Salary, Balance, Price, Quantity, Spend, Age, Revenue).
2. EXACT ROW LIMITS:
   - Pay strict attention to limits in the user question:
     * "first 10 rows" / "see first 10 row" / "show 10 rows" -> LIMIT 10
     * "top 5" -> LIMIT 5
     * "first 20" -> LIMIT 20
   - If the user specifies an exact number N, use EXACTLY `LIMIT N`.
3. BROWSING / PREVIEWS:
   - If the user asks to "see", "show", "view", "preview", "display" rows of the dataset without aggregation (e.g. "see first 10 row"), generate:
     SELECT * FROM dataset LIMIT 10
4. RANKING & GROUP BY:
   - When asked "which [category] has the highest [count / number of items]", write:
     SELECT "Category", COUNT(*) as count FROM dataset GROUP BY "Category" ORDER BY count DESC LIMIT 10
   - When asked "which [category] has the highest [measure]" (e.g. total salary), write:
     SELECT "Category", SUM("Measure") as total_Measure FROM dataset GROUP BY "Category" ORDER BY total_Measure DESC LIMIT 10
5. SYNTAX & COMPATIBILITY:
   - Always enclose column names in double quotes if they contain special characters, spaces, or mixed case: e.g. "Gender", "CustomerID", "EstimatedSalary".
   - Use standard SQLite functions (COUNT, SUM, AVG, MIN, MAX, ROUND, UPPER, LOWER, strftime).
   - Return ONLY the raw SQL query. Do not wrap in markdown (no ```sql), do not add comments or explanatory text.
   - Do not include trailing semicolons.
"""

    llm_output = _call_gemini(prompt)
    if llm_output:
        cleaned = clean_sql(llm_output)
        cleaned = re.sub(r"^SQL\s*:\s*", "", cleaned, flags=re.IGNORECASE)
        try:
            return validate_sql(cleaned)
        except Exception:
            pass

    # Use deterministic semantic fallback
    return _rule_based_sql_fallback(question, schema)


def explain_query_result(question: str, sql: str, result: dict[str, Any]) -> str:
    """
    Generate a concise, grounded explanation of what the query computed and its answer.
    """
    rows = result.get("rows", [])
    row_count = result.get("row_count", 0)

    if row_count == 0:
        return "The query executed successfully but found no records matching your criteria."

    # First 10 rows as context
    sample_context = rows[:10]

    prompt = f"""
You are a senior data analyst. Answer the user's question concisely based STRICTLY on the SQL execution results below.

USER QUESTION:
"{question}"

SQL EXECUTED:
{sql}

QUERY RESULT ({row_count} total rows returned):
{sample_context}

RULES:
1. Provide a direct, 1-3 sentence grounded answer clearly answering the user's question.
2. Quote exact numbers, category names, and values from the query result. Do not hallucinate.
3. If the query ranked results, highlight the #1 leader and compare with subsequent values if helpful.
"""

    explanation = _call_gemini(prompt)
    if explanation:
        return explanation.strip()

    # Rule-based fallback explanation
    first_row = rows[0]
    items_summary = ", ".join([f"{k}: {v}" for k, v in list(first_row.items())[:3]])
    total_ds_rows = result.get("total_dataset_rows", 0)
    cov_str = f" computed over 100% of dataset ({total_ds_rows:,} records)" if total_ds_rows > 0 else ""
    return (
        f"Query executed in {result.get('execution_time_ms', 0)}ms{cov_str} and returned {row_count} row(s). "
        f"Top result: ({items_summary})."
    )
