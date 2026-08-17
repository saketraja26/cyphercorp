from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.auth.security import settings as auth_settings


admin_bearer_scheme = HTTPBearer()


async def get_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(admin_bearer_scheme),
):
    """
    Dependency that verifies the JWT contains role='admin'.
    Used to protect all admin-only endpoints.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            auth_settings.jwt_secret_key,
            algorithms=[auth_settings.jwt_algorithm],
        )

        role = payload.get("role")
        if role != "admin":
            raise ValueError("Not an admin token")

        return {"role": "admin", "sub": payload.get("sub", "admin")}

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )
