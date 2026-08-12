from pathlib import Path
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_PATH = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./cyphercorp.db"

    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    class Config:
        env_file = [str(_ENV_PATH), ".env", "backend/.env"]
        extra = "ignore"


settings = Settings()