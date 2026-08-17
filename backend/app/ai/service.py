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


def _get_admin_provider_preference() -> tuple[str, str]:
    """
    Synchronously read the admin-configured provider/model from the DB.
    Returns (active_provider, active_model). Defaults to ("auto", "").
    """
    try:
        from sqlalchemy import create_engine, select as sa_select, text
        from app.config import settings as app_settings
        from app.models.admin_settings import AdminSettings

        # Build a synchronous engine for this quick read
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
        print(f"[AdminSettings] Could not read preference: {exc}")

    return ("auto", "")


def ask_ai(prompt: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Execute LLM analysis respecting admin-selected provider preference.
    Provider priority: admin setting > auto (OpenAI → Gemini) > rule-based fallback.
    """
    last_error = ""
    admin_provider, admin_model = _get_admin_provider_preference()

    def _try_openai(model_override: str = "") -> dict[str, Any] | None:
        if not settings.openai_api_key or settings.openai_api_key.startswith("your_"):
            return None
        try:
            client = OpenAI(api_key=settings.openai_api_key)
            model_to_use = model_override or settings.openai_model or "gpt-4.1-mini"
            completion = client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert principal data scientist and automated EDA analyst.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
            )
            if completion.choices and completion.choices[0].message.content:
                parsed = _parse_ai_sections(completion.choices[0].message.content)
                parsed["status"] = "success"
                parsed["model_used"] = model_to_use
                parsed["provider"] = "openai"
                return parsed
        except Exception as exc:
            nonlocal last_error
            last_error = f"OpenAI error: {str(exc)}"
            print(f"[OpenAI Warning] Failed: {last_error[:150]}")
        return None

    def _try_gemini(model_override: str = "") -> dict[str, Any] | None:
        if not settings.gemini_api_key or settings.gemini_api_key.startswith("your_") or genai is None:
            return None
        client = genai.Client(api_key=settings.gemini_api_key)
        candidate_models = []
        if model_override:
            candidate_models.append(model_override)
        candidate_models.append(settings.gemini_model)
        candidate_models.extend(m for m in FALLBACK_MODELS if m != settings.gemini_model)

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
                    parsed["provider"] = "gemini"
                    return parsed
            except Exception as exc:
                nonlocal last_error
                last_error = f"Gemini error: {str(exc)}"
                print(f"[Gemini Warning] Model {model_name} failed: {str(exc)[:150]}")
                continue
        return None

    # Dispatch based on admin preference
    if admin_provider == "openai":
        result = _try_openai(admin_model)
        if result:
            return result
    elif admin_provider == "gemini":
        result = _try_gemini(admin_model)
        if result:
            return result
    else:
        # auto mode: try OpenAI first, then Gemini
        result = _try_openai(admin_model if admin_model and "gpt" in admin_model.lower() else "")
        if result:
            return result
        result = _try_gemini(admin_model if admin_model and "gemini" in admin_model.lower() else "")
        if result:
            return result

    # Graceful Rule-Based Fallback
    print(f"[AI Non-Fatal Fallback] Returning deterministic summary. Last error: {last_error[:150]}")
    return generate_fallback_analysis(context or {}, last_error)