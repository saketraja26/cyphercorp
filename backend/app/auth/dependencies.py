from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_access_token
from app.database.database import AsyncSessionLocal
from app.models.user import User


bearer_scheme = HTTPBearer()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    token = credentials.credentials

    print("\n========== AUTH DEBUG ==========")
    print("TOKEN RECEIVED:", token[:30] + "..." if token else "NO TOKEN")

    try:
        user_id = decode_access_token(token)
        print("DECODED USER ID:", user_id)

    except ValueError as e:
        print("TOKEN DECODE ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    print("USER FOUND:", user is not None)

    if user is None:
        print("NO USER FOR ID:", user_id)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    print("AUTH SUCCESS:", user.email)
    print("================================\n")

    return user