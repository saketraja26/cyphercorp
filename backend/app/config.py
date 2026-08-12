from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str

    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()