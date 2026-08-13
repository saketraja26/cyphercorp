import secrets
from app.auth.dependencies import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


from app.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    GoogleLoginRequest,
)
from app.auth.security import (
    create_access_token,
    hash_password_async,
    verify_password_async,
    verify_google_token,
)
from app.database.database import AsyncSessionLocal
from app.models.user import User


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# -------------------------
# REGISTER (FAST SINGLE-PASS)
# -------------------------

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    email_clean = data.email.lower().strip()
    result = await db.execute(
        select(User).where(
            User.email == email_clean
        )
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    # Fast non-blocking password hashing
    password_hash = await hash_password_async(data.password)

    user = User(
        name=data.name.strip(),
        email=email_clean,
        password_hash=password_hash,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Immediately issue token for instant zero-lag login
    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


# -------------------------
# LOGIN (NON-BLOCKING FAST VERIFICATION)
# -------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    email_clean = data.email.lower().strip()
    result = await db.execute(
        select(User).where(
            User.email == email_clean
        )
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    is_valid = await verify_password_async(
        data.password,
        user.password_hash,
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


# -------------------------
# GOOGLE SIGN-IN / OAUTH
# -------------------------

@router.post(
    "/google",
    response_model=TokenResponse,
)
async def google_auth(
    data: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    if not data.credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential token is required.",
        )

    try:
        google_payload = await verify_google_token(data.credential)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(err)}",
        )

    email_clean = google_payload["email"].lower().strip()
    name_clean = (google_payload.get("name") or email_clean.split("@")[0]).strip()

    result = await db.execute(
        select(User).where(User.email == email_clean)
    )
    user = result.scalar_one_or_none()

    if not user:
        # Auto-create user account with random unusable password hash
        random_secret = secrets.token_urlsafe(32)
        pwd_hash = await hash_password_async(random_secret)
        user = User(
            name=name_clean,
            email=email_clean,
            password_hash=pwd_hash,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name cannot be empty.",
        )

    # Re-fetch user in session to ensure attached instance
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.name = name
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not data.current_password or not data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password and new password are required.",
        )

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )

    # Re-fetch user in session
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if not await verify_password_async(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password.",
        )

    user.password_hash = await hash_password_async(data.new_password)
    await db.commit()

    return {
        "status": "success",
        "message": "Password updated successfully.",
    }