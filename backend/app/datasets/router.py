from datetime import datetime

import csv
import shutil
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)

from pydantic import BaseModel

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.database import get_db
from app.models.dataset import Dataset
from app.models.user import User
from app.datasets.storage import ensure_dataset_file, get_upload_dir
from app.profiling.profiler import profile_csv
from app.profiling.statistics import calculate_statistics
from app.profiling.data_quality import analyze_data_quality
from app.profiling.visualizations import generate_visualization_data
from app.profiling.insights import generate_insights
from app.ai.service import build_analysis_context, build_analysis_prompt, ask_ai

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter(
    prefix="/datasets",
    tags=["Datasets"],
)


class DatasetCreate(BaseModel):
    name: str
    file_path: str
    row_count: int = 0
    column_count: int = 0


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    data: DatasetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dataset = Dataset(
        name=data.name,
        file_path=data.file_path,
        row_count=data.row_count,
        column_count=data.column_count,
        user_id=current_user.id,
        created_at=datetime.utcnow(),
    )

    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    return dataset



@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Check filename
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided.",
        )

    # 2. Check extension
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported.",
        )

    # 3. Sanitize filename
    safe_filename = Path(file.filename).name

    # 4. Create user-specific directory
    upload_dir = get_upload_dir()
    user_directory = upload_dir / str(current_user.id)
    user_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    file_path = user_directory / safe_filename

    # 5. Auto-version filename if it already exists for this user
    base_stem = Path(safe_filename).stem
    suffix = Path(safe_filename).suffix
    counter = 1
    while file_path.exists():
        safe_filename = f"{base_stem}_{counter}{suffix}"
        file_path = user_directory / safe_filename
        counter += 1

    # 6. Save uploaded file while checking size
    total_size = 0

    try:
        with file_path.open("wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    buffer.close()

                    if file_path.exists():
                        file_path.unlink()

                    raise HTTPException(
                        status_code=413,
                        detail="File is too large. Maximum size is 10 MB.",
                    )

                buffer.write(chunk)

    finally:
        await file.close()

    # 7. Reject empty files
    if total_size == 0:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    # 8. Read and validate CSV
    row_count = 0
    column_count = 0

    try:
        with file_path.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as csv_file:

            reader = csv.reader(csv_file)

            try:
                headers = next(reader)
            except StopIteration:
                raise HTTPException(
                    status_code=400,
                    detail="The CSV file is empty.",
                )

            # Make sure headers exist
            if not headers or not any(header.strip() for header in headers):
                raise HTTPException(
                    status_code=400,
                    detail="The CSV file does not contain valid headers.",
                )

            column_count = len(headers)

            for row in reader:
                row_count += 1

                # Check that rows have the expected number of columns
                if len(row) != column_count:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Invalid CSV structure. "
                            "Some rows have a different number "
                            "of columns than the header."
                        ),
                    )

    except UnicodeDecodeError:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=400,
            detail="The CSV file must use UTF-8 encoding.",
        )

    except csv.Error:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid CSV.",
        )

    except HTTPException:
        if file_path.exists():
            file_path.unlink()

        raise

    # Run dataset profiler
    try:
        profile = profile_csv(str(file_path))

    except Exception as exc:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=f"Unable to analyze CSV file: {str(exc)}",
        )

    # Read text content to persist in PostgreSQL table
    try:
        csv_text_content = file_path.read_text(encoding="utf-8-sig", errors="replace")
    except Exception:
        csv_text_content = None

    # 9. Create database record
    dataset = Dataset(
        name=Path(safe_filename).stem,
        file_path=str(file_path),
        csv_data=csv_text_content,
        row_count=row_count,
        column_count=column_count,
        user_id=current_user.id,
        created_at=datetime.utcnow(),
    )

    db.add(dataset)

    await db.commit()
    await db.refresh(dataset)

    return {
        "dataset": dataset,
        "profile": profile,
    }

@router.get("/")
async def get_datasets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select

    result = await db.execute(
        select(Dataset)
        .where(Dataset.user_id == current_user.id)
        .order_by(Dataset.created_at.desc())
    )

    return result.scalars().all()

@router.get("/{dataset_id}/profile")
async def get_dataset_profile(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)
    profile = profile_csv(str(file_path))

    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "profile": profile,
    }


@router.get("/{dataset_id}/statistics")
async def get_dataset_statistics(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        statistics = calculate_statistics(str(file_path))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to calculate statistics: {str(exc)}",
        )

    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "statistics": statistics,
    }


@router.get("/{dataset_id}/quality")
async def get_dataset_quality(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        quality = analyze_data_quality(str(file_path))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to analyze data quality: {str(exc)}",
        )

    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "quality": quality,
    }


@router.get("/{dataset_id}/summary")
async def get_dataset_summary(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        profile = profile_csv(str(file_path))
        statistics = calculate_statistics(str(file_path))
        quality = analyze_data_quality(str(file_path))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to analyze dataset: {str(exc)}",
        )

    return {
        "dataset": {
            "id": dataset.id,
            "name": dataset.name,
            "file_path": dataset.file_path,
            "row_count": dataset.row_count,
            "column_count": dataset.column_count,
            "created_at": dataset.created_at,
        },
        "profile": profile,
        "statistics": statistics,
        "quality": quality,
    }


@router.get("/{dataset_id}/visualizations")
async def get_dataset_visualizations(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        visualization_data = generate_visualization_data(str(file_path))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to generate visualization data: {str(exc)}",
        )

    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "visualizations": visualization_data,
    }


@router.get("/{dataset_id}/insights")
async def get_dataset_insights(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        statistics = calculate_statistics(str(file_path))
        quality = analyze_data_quality(str(file_path))
        visualizations = generate_visualization_data(str(file_path))
        correlations = visualizations.get("correlations", {})
        insights = generate_insights(statistics, quality, correlations)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to generate insights: {str(exc)}",
        )

    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "insights": insights,
    }


@router.get("/{dataset_id}/ai-analysis")
async def get_dataset_ai_analysis(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        statistics = calculate_statistics(str(file_path))
        quality = analyze_data_quality(str(file_path))
        visualizations = generate_visualization_data(str(file_path))
        correlations = visualizations.get("correlations", {})
        insights = generate_insights(statistics, quality, correlations)
        context = build_analysis_context(statistics, quality, insights, correlations)
        prompt = build_analysis_prompt(context)
        ai_analysis = ask_ai(prompt, context)

        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "analysis": ai_analysis,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis error: {str(exc)}",
        )


@router.get("/{dataset_id}/analysis")
async def get_dataset_analysis(
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
            status_code=404,
            detail="Dataset not found.",
        )

    file_path = ensure_dataset_file(dataset)

    try:
        # Generate complete EDA payload
        profile = profile_csv(str(file_path))
        statistics = calculate_statistics(str(file_path))
        quality = analyze_data_quality(str(file_path))
        visualizations = generate_visualization_data(str(file_path))
        correlations = visualizations.get("correlations", {})
        insights = generate_insights(statistics, quality, correlations)

        # Build AI context and prompt
        context = build_analysis_context(
            statistics=statistics,
            quality=quality,
            insights=insights,
            correlations=correlations,
        )
        prompt = build_analysis_prompt(context)

        # Safe non-fatal AI analysis
        ai_analysis = ask_ai(prompt, context)

        return {
            "dataset": {
                "id": dataset.id,
                "name": dataset.name,
                "file_path": dataset.file_path,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count,
                "created_at": dataset.created_at,
            },
            "profile": profile,
            "statistics": statistics,
            "quality": quality,
            "visualizations": visualizations,
            "correlations": correlations,
            "insights": insights,
            "ai_analysis": ai_analysis,
        }

    except Exception as exc:
        print("=== DATASET ANALYSIS ERROR ===")
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate dataset analysis: {str(exc)}",
        )