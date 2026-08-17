import asyncio
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.database import get_db
from app.models.dataset import Dataset
from app.models.user import User
from app.datasets.storage import ensure_dataset_file
from app.ml.preprocessor import get_target_candidates
from app.ml.trainer import train_automl_pipeline, MODELS_DIR
from app.ml.predictor import predict_sample
import joblib

router = APIRouter(
    prefix="/datasets",
    tags=["AutoML Engine"],
)


class TrainModelRequest(BaseModel):
    target_column: str
    excluded_features: list[str] | None = None
    included_features: list[str] | None = None
    selected_algorithm: str | None = None


class PredictRequest(BaseModel):
    model_file: str
    features: dict[str, Any]
    selected_model_name: str | None = None


@router.get("/{dataset_id}/ml/targets")
async def get_ml_target_candidates(
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
        analysis_payload = get_target_candidates(str(file_path))
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "target_candidates": analysis_payload.get("target_candidates", []),
            "recommended_target": analysis_payload.get("recommended_target", ""),
            "identifier_columns": analysis_payload.get("identifier_columns", []),
            "recommendation_banner": analysis_payload.get("recommendation_banner", ""),
            "feature_intelligence": analysis_payload.get("feature_intelligence", []),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to extract target candidates: {str(exc)}",
        )


@router.get("/{dataset_id}/ml/benchmark")
async def get_dataset_benchmark(
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

    benchmark_path = MODELS_DIR / f"benchmark_ds_{dataset.id}.joblib"
    if benchmark_path.exists():
        try:
            cached_data = joblib.load(benchmark_path)
            return cached_data
        except Exception:
            pass

    return {"benchmark": None}


@router.post("/{dataset_id}/ml/train")
async def train_dataset_models(
    dataset_id: int,
    payload: TrainModelRequest,
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
        # Non-blocking async thread execution to keep server responsive
        training_result = await asyncio.to_thread(
            train_automl_pipeline,
            file_path=str(file_path),
            target_column=payload.target_column,
            dataset_id=dataset.id,
            excluded_features=payload.excluded_features,
            included_features=payload.included_features,
        )
        return training_result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model training failed: {str(exc)}",
        )


@router.post("/{dataset_id}/ml/predict")
async def predict_with_model(
    dataset_id: int,
    payload: PredictRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        prediction_result = predict_sample(
            model_path=payload.model_file,
            input_data=payload.features,
        )
        return prediction_result
    except FileNotFoundError as fnf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(fnf),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prediction error: {str(exc)}",
        )
