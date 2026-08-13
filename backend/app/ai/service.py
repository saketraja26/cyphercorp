import re
from typing import Any

try:
    from google import genai
except (ImportError, AttributeError):
    genai = None

from app.config import settings

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
]


def build_analysis_context(
    statistics: dict[str, Any],
    quality: dict[str, Any],
    insights: list[dict[str, Any]],
    correlations: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a structured context that will be sent to the AI/LLM."""
    return {
        "dataset": {
            "statistics": statistics,
            "quality": quality,
            "insights": insights,
            "correlations": correlations or {},
        }
    }


def build_analysis_prompt(context: dict[str, Any]) -> str:
    """Build the prompt that will be sent to the AI model."""
    dataset = context.get("dataset", {})
    statistics = dataset.get("statistics", {})
    quality = dataset.get("quality", {})
    insights = dataset.get("insights", [])
    correlations = dataset.get("correlations", {})

    prompt = f"""
You are an expert principal data scientist and automated EDA analyst.

Analyze the dataset summary below and generate a professional, clear, and actionable data report.

DATASET STATISTICS:
{statistics}

DATA QUALITY & OUTLIERS:
{quality}

AUTOMATICALLY DETECTED INSIGHTS:
{insights}

CORRELATIONS:
{correlations}

Return your response using EXACTLY this structured format (use clear bullet points with 'Title: Description'):

SUMMARY:
<2-3 concise sentences summarizing what the dataset represents, its dimensions, and overall structure>

DATA QUALITY:
<Concise assessment of missing values, duplicate rows, outliers, and data health score>

KEY FINDINGS:
• <Finding 1 Topic>: <Detailed explanation of pattern, correlation, or distribution>
• <Finding 2 Topic>: <Detailed explanation of pattern, correlation, or distribution>
• <Finding 3 Topic>: <Detailed explanation of pattern, correlation, or distribution>

RECOMMENDATIONS:
• <Action 1 Topic>: <Actionable next step for cleaning, engineering, or modeling>
• <Action 2 Topic>: <Actionable next step for cleaning, engineering, or modeling>
• <Action 3 Topic>: <Actionable next step for cleaning, engineering, or modeling>
"""
    return prompt.strip()


def _clean_markdown_artifacts(text: str) -> str:
    """Clean unclosed asterisks and normalize section text."""
    if not text:
        return ""
    lines = []
    for line in text.split("\n"):
        clean_line = line.strip()
        # Normalize patterns like 'Topic:** Description' to 'Topic: Description'
        clean_line = re.sub(r"^([A-Za-z0-9\s_\-\(\)`\/\.,]+):\*\*\s*", r"\1: ", clean_line)
        lines.append(clean_line)
    return "\n".join(lines).strip()


def _parse_ai_sections(raw_text: str) -> dict[str, Any]:
    """Parse structured AI response into sections."""
    sections = {
        "summary": "",
        "data_quality": "",
        "key_findings": "",
        "recommendations": "",
        "raw_text": raw_text,
    }

    patterns = {
        "summary": r"SUMMARY:\s*(.*?)(?=\n(?:DATA QUALITY|KEY FINDINGS|RECOMMENDATIONS):|$)",
        "data_quality": r"DATA QUALITY:\s*(.*?)(?=\n(?:SUMMARY|KEY FINDINGS|RECOMMENDATIONS):|$)",
        "key_findings": r"KEY FINDINGS:\s*(.*?)(?=\n(?:SUMMARY|DATA QUALITY|RECOMMENDATIONS):|$)",
        "recommendations": r"RECOMMENDATIONS:\s*(.*?)(?=\n(?:SUMMARY|DATA QUALITY|KEY FINDINGS):|$)",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, raw_text, re.DOTALL | re.IGNORECASE)
        if match:
            sections[key] = _clean_markdown_artifacts(match.group(1).strip())

    if not sections["summary"] and raw_text:
        sections["summary"] = _clean_markdown_artifacts(raw_text[:300].strip())

    return sections


def generate_fallback_analysis(context: dict[str, Any], reason: str = "") -> dict[str, Any]:
    """Generate a high-quality deterministic fallback summary when AI service is unavailable."""
    dataset = context.get("dataset", {})
    quality = dataset.get("quality", {})
    stats = dataset.get("statistics", {})
    insights = dataset.get("insights", [])

    row_count = stats.get("row_count", 0)
    col_count = stats.get("column_count", 0)
    health_score = quality.get("health_score", 100.0)
    health_status = quality.get("health_status", "Good")
    missing_pct = quality.get("missing_percentage", 0.0)
    dup_rows = quality.get("duplicate_rows", 0)
    outliers = quality.get("outliers", [])

    summary = (
        f"The dataset consists of {row_count:,} records across {col_count} columns. "
        f"Automated profiling assessed an overall data health score of {health_score}/100 ({health_status})."
    )

    quality_text = (
        f"Missing cells account for {missing_pct:.1f}% of total data with {dup_rows:,} duplicate records. "
        f"{len(outliers)} numeric column(s) exhibit potential statistical outliers based on IQR boundaries."
    )

    findings = []
    for ins in insights[:4]:
        findings.append(f"• {ins.get('message', '')}")
    findings_text = "\n".join(findings) if findings else "• Baseline profiling completed without critical flags."

    recommendations = (
        "1. Address any missing values via domain-specific imputation or removal.\n"
        "2. Review outlier distributions before training sensitive regression or classification models.\n"
        "3. Encode high-cardinality categorical attributes before downstream analysis."
    )

    return {
        "status": "fallback",
        "fallback_notice": f"AI generation is currently resting (Quota / Rate-Limit). High-accuracy rule-based intelligence is shown below.",
        "summary": summary,
        "data_quality": quality_text,
        "key_findings": findings_text,
        "recommendations": recommendations,
        "raw_text": f"SUMMARY:\n{summary}\n\nDATA QUALITY:\n{quality_text}\n\nKEY FINDINGS:\n{findings_text}\n\nRECOMMENDATIONS:\n{recommendations}",
    }


def ask_ai(prompt: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Call Gemini LLM with model fallback and non-fatal error handling.
    Returns structured analysis dict.
    """
    if not settings.gemini_api_key or settings.gemini_api_key.startswith("your_"):
        return generate_fallback_analysis(context or {}, "Missing API Key")

    if genai is None:
        return generate_fallback_analysis(context or {}, "google.genai SDK not installed in active environment")

    client = genai.Client(api_key=settings.gemini_api_key)

    candidate_models = [settings.gemini_model] + [
        m for m in FALLBACK_MODELS if m != settings.gemini_model
    ]

    last_error = ""

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )

            if response and response.text:
                parsed = _parse_ai_sections(response.text)
                parsed["status"] = "success"
                parsed["model_used"] = model_name
                return parsed

        except Exception as exc:
            err_str = str(exc)
            last_error = err_str
            print(f"[Gemini Warning] Model {model_name} failed: {err_str[:150]}")
            # If 429 or NOT_FOUND, try next candidate model
            continue

    # If all models exhausted or failed, return graceful fallback
    print(f"[Gemini Non-Fatal Fallback] All models failed. Last error: {last_error[:150]}")
    fallback = generate_fallback_analysis(context or {}, last_error)
    return fallback