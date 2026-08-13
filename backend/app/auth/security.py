import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import httpx
from jose import JWTError, jwt
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = _BACKEND_DIR / ".env"


class AuthSettings(BaseSettings):
    jwt_secret_key: str = "default_secret_key_change_in_production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days for smooth UX
    google_client_id: str | None = None

    class Config:
        env_file = [str(_ENV_PATH), ".env", "backend/.env"]
        extra = "ignore"


settings = AuthSettings()


def hash_password(password: str) -> str:
    """Synchronous password hashing with optimized rounds=10 for fast sub-50ms execution."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Synchronous password verification."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


async def hash_password_async(password: str) -> str:
    """Non-blocking password hashing executed in a background worker thread."""
    return await asyncio.to_thread(hash_password, password)


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """Non-blocking password verification executed in a background worker thread."""
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)


async def verify_google_token(credential: str) -> dict:
    """
    Verifies a Google ID token with Google's tokeninfo API.
    Returns decoded payload dict with email, name, sub (google_id), picture.
    """
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise ValueError("Invalid Google authentication token.")

        data = response.json()
        email = data.get("email")
        if not email:
            raise ValueError("Google account does not provide an email address.")

        name = data.get("name") or data.get("given_name") or email.split("@")[0]
        return {
            "email": email,
            "name": name,
            "google_id": data.get("sub"),
            "picture": data.get("picture"),
            "email_verified": data.get("email_verified", True),
        }


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )

    payload = {
        "sub": str(user_id),
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise ValueError("Invalid token")

        return int(user_id)

    except (JWTError, ValueError):
        raise ValueError("Invalid or expired token")