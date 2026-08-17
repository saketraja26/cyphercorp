from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import get_admin_user
from app.admin.schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminProvidersResponse,
    AdminSettingsResponse,
    AdminSettingsUpdateRequest,
    ProviderStatus,
)
from app.auth.security import settings as auth_settings
from app.config import settings
from app.database.database import AsyncSessionLocal
from app.models.admin_settings import AdminSettings


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)

VALID_PROVIDERS = {"auto", "openai", "gemini"}


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ------------------------------------------------------------------
# Admin Login — credentials from environment variables
# ------------------------------------------------------------------

@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(data: AdminLoginRequest):
    expected_username = settings.admin_username
    expected_password = settings.admin_password

    if not expected_username or not expected_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin credentials are not configured on the server.",
        )

    if data.username != expected_username or data.password != expected_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
        )

    # Issue a short-lived admin JWT (24 hours)
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {
        "sub": "admin",
        "role": "admin",
        "exp": expire,
    }
    admin_token = jwt.encode(
        payload,
        auth_settings.jwt_secret_key,
        algorithm=auth_settings.jwt_algorithm,
    )

    return {"admin_token": admin_token}


# ------------------------------------------------------------------
# Get Current Admin Settings
# ------------------------------------------------------------------

@router.get("/settings", response_model=AdminSettingsResponse)
async def get_admin_settings(
    _admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminSettings).where(AdminSettings.id == 1))
    row = result.scalar_one_or_none()

    if not row:
        return AdminSettingsResponse(
            active_provider="auto",
            active_model="",
            updated_at=None,
        )

    return AdminSettingsResponse(
        active_provider=row.active_provider,
        active_model=row.active_model,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


# ------------------------------------------------------------------
# Update Admin Settings
# ------------------------------------------------------------------

@router.put("/settings", response_model=AdminSettingsResponse)
async def update_admin_settings(
    data: AdminSettingsUpdateRequest,
    _admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if data.active_provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {', '.join(VALID_PROVIDERS)}",
        )

    result = await db.execute(select(AdminSettings).where(AdminSettings.id == 1))
    row = result.scalar_one_or_none()

    if row:
        row.active_provider = data.active_provider
        row.active_model = data.active_model
        row.updated_at = datetime.utcnow()
    else:
        row = AdminSettings(
            id=1,
            active_provider=data.active_provider,
            active_model=data.active_model,
            updated_at=datetime.utcnow(),
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)

    return AdminSettingsResponse(
        active_provider=row.active_provider,
        active_model=row.active_model,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


# ------------------------------------------------------------------
# List Available Providers
# ------------------------------------------------------------------

@router.get("/providers", response_model=AdminProvidersResponse)
async def get_providers(
    _admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    openai_configured = bool(
        settings.openai_api_key and not settings.openai_api_key.startswith("your_")
    )
    gemini_configured = bool(
        settings.gemini_api_key and not settings.gemini_api_key.startswith("your_")
    )

    providers = [
        ProviderStatus(
            name="openai",
            configured=openai_configured,
            default_model=settings.openai_model or "gpt-4.1-mini",
        ),
        ProviderStatus(
            name="gemini",
            configured=gemini_configured,
            default_model=settings.gemini_model or "gemini-3.5-flash-lite",
        ),
    ]

    # Read current admin selection
    result = await db.execute(select(AdminSettings).where(AdminSettings.id == 1))
    row = result.scalar_one_or_none()

    active_provider = row.active_provider if row else "auto"
    active_model = row.active_model if row else ""

    return AdminProvidersResponse(
        providers=providers,
        active_provider=active_provider,
        active_model=active_model,
    )
