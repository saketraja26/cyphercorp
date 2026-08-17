from pydantic import BaseModel


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    admin_token: str
    token_type: str = "bearer"


class AdminSettingsResponse(BaseModel):
    active_provider: str
    active_model: str
    updated_at: str | None = None


class AdminSettingsUpdateRequest(BaseModel):
    active_provider: str  # "auto" | "openai" | "gemini"
    active_model: str = ""


class ProviderStatus(BaseModel):
    name: str  # "openai" | "gemini"
    configured: bool
    default_model: str


class AdminProvidersResponse(BaseModel):
    providers: list[ProviderStatus]
    active_provider: str
    active_model: str
