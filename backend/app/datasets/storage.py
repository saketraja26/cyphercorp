import os
from pathlib import Path
from fastapi import HTTPException, status
from app.models.dataset import Dataset

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_UPLOAD_DIR = BACKEND_DIR / "uploads"


def get_upload_dir() -> Path:
    """Return the base upload directory and ensure it exists."""
    upload_dir = Path(os.getenv("UPLOAD_DIR", str(DEFAULT_UPLOAD_DIR)))
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def ensure_dataset_file(dataset: Dataset) -> Path:
    """
    Ensure the dataset CSV file is available on local disk.
    If the file is missing (e.g. after cloud container restart, Render/Railway instance sleep),
    this automatically restores/re-hydrates the file from the database's `csv_data`.
    """
    upload_base = get_upload_dir()
    primary_path = Path(dataset.file_path)

    # 1. If already on disk at recorded path
    if primary_path.is_file():
        return primary_path

    # 2. Check alternative relative/absolute paths
    alt_paths = [
        upload_base / str(dataset.user_id) / primary_path.name,
        Path("uploads") / str(dataset.user_id) / primary_path.name,
        BACKEND_DIR / primary_path,
        BACKEND_DIR / "uploads" / str(dataset.user_id) / f"{dataset.name}.csv",
    ]
    for alt in alt_paths:
        if alt.is_file():
            return alt

    # 3. Re-hydrate from DB `csv_data` if available
    if getattr(dataset, "csv_data", None):
        target_path = upload_base / str(dataset.user_id) / primary_path.name
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            target_path.write_text(dataset.csv_data, encoding="utf-8-sig")
            return target_path
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to restore dataset from database: {str(exc)}",
            )

    # 4. If neither disk nor DB has content
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=(
            f"Dataset '{dataset.name}' is no longer available on the cloud instance. "
            "Please re-upload your CSV file to continue analysis."
        ),
    )
