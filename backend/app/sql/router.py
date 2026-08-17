from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.database import get_db
from app.models.dataset import Dataset
from app.models.user import User
from app.datasets.storage import ensure_dataset_file
from app.sql.sql_engine import execute_sql_query, get_dataset_schema
from app.sql.sql_generator import (
    explain_query_result,
    generate_sql_from_nl,
    generate_suggested_questions,
    get_active_ai_provider,
)

router = APIRouter(
    prefix="/datasets",
    tags=["SQL Analyst"],
)


class SqlQueryRequest(BaseModel):
    query: str | None = None  # Natural language query
    sql: str | None = None  # Raw SQL query
    mode: str = "nl"  # "nl" or "raw_sql"


@router.get("/{dataset_id}/sql/schema")
async def get_sql_schema(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.user_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        schema = get_dataset_schema(str(file_path))
        suggestions = generate_suggested_questions(schema)
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "schema": schema,
            "suggested_questions": suggestions,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read schema: {str(exc)}",
        )


@router.post("/{dataset_id}/sql/query")
async def execute_query_endpoint(
    dataset_id: int,
    payload: SqlQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.user_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)
    schema = get_dataset_schema(str(file_path))
    suggested = generate_suggested_questions(schema)

    # 1. Determine SQL to execute
    if payload.mode == "raw_sql" and payload.sql:
        sql_to_run = payload.sql.strip()
        question = payload.query or "Custom SQL Query"
    elif payload.query:
        question = payload.query.strip()
        try:
            sql_to_run = generate_sql_from_nl(question, schema)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unable to generate SQL: {str(exc)}",
            )
    elif payload.sql:
        sql_to_run = payload.sql.strip()
        question = "Custom SQL Query"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either a natural language query or a SQL query.",
        )

    # 2. Execute SQL with strict validation
    try:
        query_result = execute_sql_query(str(file_path), sql_to_run)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query execution failed: {str(exc)}",
        )

    # 3. Grounded Explanation
    explanation = explain_query_result(question, query_result["sql"], query_result)
    ai_provider = get_active_ai_provider()

    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "question": question,
        "sql": query_result["sql"],
        "columns": query_result["columns"],
        "rows": query_result["rows"],
        "row_count": query_result["row_count"],
        "total_dataset_rows": query_result.get("total_dataset_rows", 0),
        "scanned_percentage": query_result.get("scanned_percentage", 100.0),
        "is_aggregate": query_result.get("is_aggregate", False),
        "execution_time_ms": query_result["execution_time_ms"],
        "explanation": explanation,
        "suggested_questions": suggested,
        "ai_provider": ai_provider,
    }
