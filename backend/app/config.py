from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache
from typing import Union


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "TicketTracker"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tickettracker:tickettracker_pass@localhost:5434/tickettracker"

    # Atlassian OAuth 2.0 (3LO)
    ATLASSIAN_CLIENT_ID: str = ""
    ATLASSIAN_CLIENT_SECRET: str = ""
    ATLASSIAN_REDIRECT_URI: str = "http://localhost:8002/api/auth/callback"
    ATLASSIAN_CLOUD_URL: str = "https://amd.atlassian.net"
    ATLASSIAN_AUTH_URL: str = "https://auth.atlassian.com/authorize"
    ATLASSIAN_TOKEN_URL: str = "https://auth.atlassian.com/oauth/token"
    ATLASSIAN_SCOPES: str = "read:jira-work write:jira-work read:jira-user offline_access"

    # JWT (for session tokens after OAuth completes)
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days (refresh token handles Atlassian re-auth)

    # Frontend / Backend URLs
    FRONTEND_URL: str = "http://localhost:5174"
    BACKEND_URL: str = "http://localhost:8002"

    # CORS
    CORS_ORIGINS: Union[list[str], str] = "http://localhost:5174,http://failsafe.amd.com"

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
