import re
from typing import Any
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype

# Exact standalone identifier names
EXACT_ID_NAMES = {
    "id",
    "pk",
    "key",
    "uuid",
    "guid",
    "ssn",
    "hash",
    "token",
    "index",
    "row_id",
    "row_number",
    "row_num",
    "rownum",
    "record_id",
    "record_num",
    "unnamed: 0",
    "unnamed_0",
    "unnamed: 0.1",
}

# English words ending in 'id' that are NOT identifier tokens
NON_ID_WORDS = {
    "grid", "fluid", "liquid", "solid", "acid", "hybrid", "pyramid", "android",
    "lipid", "squid", "valid", "orchid", "morbid", "vivid", "torpid", "candid",
    "lucid", "frigid", "humid", "pallid", "rabid", "arid", "fetid", "placid",
    "tepid", "viscid", "squalid", "turbid", "timid", "rapid", "stupid", "lurid",
    "rigid", "putrid", "horrid", "splendid", "intrepid", "insipid", "gelid"
}

# Regexes matching entity identifiers (e.g., customer_id, customerid, CustomerID, cust_id, user_id, userid, orderid, etc.)
ENTITY_ID_PATTERNS = [
    r"^(.*_)?(customer|user|client|account|employee|patient|subscriber|member|order|transaction|trans|record|row|session|visitor|device|item|product|store|vendor|ticket|invoice|case|sample|lead|policy|claim|student|driver|agent|host|listing|post|comment|article|sale|payment|contract|dept|department|org|organization|company|partner|entity|person|subject|participant|respondent|household|cardholder|merchant)_?ids?$",
    r"^(.*_)?(cust|usr|acct|emp|ord|txn|trans|rec|sub|cli|pat|dev|sess|idx)_?ids?$",
    r"^id$",
    r"^.*_id$",
    r"^id_.*$",
    r"^.*_pk$",
    r"^pk_.*$",
    r"^.*_key$",
    r"^key_.*$",
    r"^.*_code$",
    r"^.*_uuid$",
    r"^.*_guid$",
    r"^uuid$",
    r"^guid$",
    r"^ssn$",
    r"^.*_num$",
    r"^.*_number$",
]

ID_REGEX_PATTERNS = ENTITY_ID_PATTERNS

UUID_REGEX = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
PREFIX_ID_REGEX = re.compile(r"^[a-zA-Z_\-]+[0-9]+$")


def _is_name_matched_id(col_name: str) -> bool:
    """Check if a column name matches entity identifier conventions."""
    col_str = str(col_name).strip()
    col_clean = re.sub(r"[^a-zA-Z0-9]", "_", col_str).lower().strip("_")

    if not col_clean:
        return False

    if col_clean in EXACT_ID_NAMES:
        return True

    if col_clean in NON_ID_WORDS:
        return False

    # Check for CamelCase split (e.g. CustomerID -> customer_id)
    camel_split = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", col_str).lower()
    camel_clean = re.sub(r"[^a-zA-Z0-9]", "_", camel_split).strip("_")

    for pat in ENTITY_ID_PATTERNS:
        if re.match(pat, col_clean, re.IGNORECASE) or re.match(pat, camel_clean, re.IGNORECASE):
            return True

    # Generic check for columns ending in 'id' with distinct word boundary
    if (col_clean.endswith("_id") or col_clean.endswith("_pk") or col_clean.endswith("_key") or col_clean.endswith("_uuid") or col_clean.endswith("_guid")):
        return True

    return False


def analyze_column_identifier(
    series: pd.Series, col_name: str, total_rows: int
) -> dict[str, Any]:
    """
    Perform deep identifier detection:
    1. Checks name patterns against standard ID conventions (CustomerID, user_id, UUID, etc.).
    2. Computes uniqueness ratio.
    3. Detects sequential integer IDs and monotonic series.
    4. Detects UUID and sequential prefix string patterns.
    """
    col_str = str(col_name).strip()
    col_clean = re.sub(r"[^a-zA-Z0-9]", "_", col_str).lower().strip("_")
    clean_series = series.dropna()

    if clean_series.empty or total_rows == 0:
        return {
            "is_identifier": False,
            "uniqueness_ratio": 0.0,
            "confidence": 0.0,
            "reason": "",
            "is_sequential": False,
        }

    unique_count = int(clean_series.nunique())
    uniqueness_ratio = round(float(unique_count / total_rows), 4)

    # 1. Check Name Patterns
    name_matched = _is_name_matched_id(col_str)

    # 2. Check Monotonicity & Sequential Integers
    is_sequential = False
    is_monotonic = False
    if is_numeric_dtype(clean_series):
        try:
            numeric_vals = pd.to_numeric(clean_series, errors="coerce").dropna()
            if len(numeric_vals) > 1:
                is_monotonic = bool(numeric_vals.is_monotonic_increasing or numeric_vals.is_monotonic_decreasing)
                diffs = numeric_vals.diff().dropna()
                if not diffs.empty and (diffs == 1).sum() / len(diffs) > 0.85:
                    is_sequential = True
        except Exception:
            pass

    # 3. Check UUID or sequential prefix pattern for string series
    is_uuid_like = False
    if not is_numeric_dtype(clean_series) and len(clean_series) > 0:
        sample_vals = [str(v).strip() for v in clean_series.head(50)]
        uuid_matches = sum(1 for v in sample_vals if UUID_REGEX.match(v))
        if uuid_matches / len(sample_vals) > 0.8:
            is_uuid_like = True
        else:
            prefix_matches = sum(1 for v in sample_vals if PREFIX_ID_REGEX.match(v))
            if prefix_matches / len(sample_vals) > 0.8:
                is_uuid_like = True

    # 4. Synthesize Identifier Confidence & Reason
    is_id = False
    confidence = 0.0
    reason = ""

    # Rule A: Name matches ID pattern + high/moderate uniqueness (e.g. CustomerID, user_id, cust_id, AccountID)
    if name_matched and (uniqueness_ratio >= 0.70 or (total_rows > 10 and uniqueness_ratio >= 0.30) or unique_count == total_rows):
        is_id = True
        confidence = 0.99
        reason = f"Column name '{col_str}' indicates an entity identifier with {uniqueness_ratio * 100:.1f}% unique values ({unique_count:,}/{total_rows:,})."

    # Rule B: Strictly sequential monotonic integer sequence with step=1 in non-trivial dataset (>= 20 rows)
    elif is_sequential and total_rows >= 20 and uniqueness_ratio >= 0.90:
        is_id = True
        confidence = 0.99
        reason = f"Column contains a strictly sequential, monotonic integer series ({unique_count:,} unique values)."

    # Rule C: UUID or prefix ID pattern with high cardinality (e.g. CUST_001, TX_101)
    elif is_uuid_like and uniqueness_ratio >= 0.80:
        is_id = True
        confidence = 0.95
        reason = f"Values match UUID / entity key format with {uniqueness_ratio * 100:.1f}% uniqueness."

    # Rule D: 100% unique string column in non-trivial dataset (> 20 rows)
    elif not is_numeric_dtype(clean_series) and total_rows >= 20 and uniqueness_ratio >= 0.98:
        is_id = True
        confidence = 0.85
        reason = f"High-cardinality string column with {uniqueness_ratio * 100:.1f}% uniqueness ({unique_count:,}/{total_rows:,})."

    # Rule E: Exact ID keyword (id, pk, key, uuid, index, row_id, unnamed: 0)
    elif col_clean in EXACT_ID_NAMES and unique_count > 1:
        is_id = True
        confidence = 0.95
        reason = f"Column name '{col_str}' matches primary entity key convention."

    return {
        "is_identifier": is_id,
        "uniqueness_ratio": uniqueness_ratio,
        "confidence": confidence,
        "reason": reason,
        "is_sequential": is_sequential,
    }


def is_identifier_column(series: pd.Series, col_name: str, total_rows: int) -> bool:
    """Convenience helper returning True if the column is an entity identifier."""
    result = analyze_column_identifier(series, col_name, total_rows)
    return bool(result.get("is_identifier", False))
