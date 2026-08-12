import re

DANGEROUS_KEYWORDS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bUPDATE\b",
    r"\bINSERT\b",
    r"\bALTER\b",
    r"\bTRUNCATE\b",
    r"\bCREATE\b",
    r"\bREPLACE\s+INTO\b",
    r"\bEXEC\b",
    r"\bEXECUTE\b",
    r"\bPRAGMA\b",
    r"\bATTACH\b",
    r"\bDETACH\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bVACUUM\b",
    r"\bREINDEX\b",
    r"\bLOAD_EXTENSION\b",
    r"\bINTO\s+OUTFILE\b",
    r"\bINTO\s+DUMPFILE\b",
]

DEFAULT_LIMIT = 500


def clean_sql(raw_sql: str) -> str:
    """Remove markdown code blocks, comments, and trailing semicolons."""
    # Remove markdown code block fences if present
    cleaned = re.sub(r"```(?:sql)?\s*", "", raw_sql, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()

    # Remove single line comments -- ...
    cleaned = re.sub(r"--[^\n]*", "", cleaned)

    # Remove multi-line comments /* ... */
    cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL)

    cleaned = cleaned.strip()
    if cleaned.endswith(";"):
        cleaned = cleaned[:-1].strip()

    return cleaned


def validate_sql(raw_sql: str) -> str:
    """
    Validate that the SQL query is strictly a safe, read-only SELECT or WITH statement.
    Raises ValueError on security violations or syntax danger.
    """
    if not raw_sql or not raw_sql.strip():
        raise ValueError("SQL query cannot be empty.")

    cleaned = clean_sql(raw_sql)

    if not cleaned:
        raise ValueError("SQL query contains no executable statements.")

    # 1. Multi-statement check (semicolon inside the query)
    if ";" in cleaned:
        raise ValueError("Multi-statement queries separated by semicolons are not permitted.")

    # 2. Must start with SELECT or WITH
    upper_query = cleaned.upper()
    if not (upper_query.startswith("SELECT") or upper_query.startswith("WITH")):
        raise ValueError("Only read-only SELECT or WITH (CTE) queries are permitted.")

    # 3. Check for dangerous keywords
    for pattern in DANGEROUS_KEYWORDS:
        if re.search(pattern, upper_query):
            keyword = pattern.replace(r"\b", "")
            raise ValueError(f"Unsafe SQL operation detected: {keyword} statements are strictly forbidden.")

    # 4. Enforce safe LIMIT
    if not re.search(r"\bLIMIT\b\s+\d+", upper_query):
        cleaned = f"{cleaned} LIMIT {DEFAULT_LIMIT}"

    return cleaned
