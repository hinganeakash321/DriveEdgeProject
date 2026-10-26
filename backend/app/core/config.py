"""Application configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized, environment-driven settings."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")

    frontend_url: str = Field(default="http://localhost:3000")
    backend_url: str = Field(default="http://localhost:8000")

    # Default to a local SQLite file so the app runs without Docker/Postgres.
    # Override with DATABASE_URL for PostgreSQL in production/Docker.
    database_url: str = Field(default="sqlite:///./driveedge.db")

    # Claude / Anthropic
    anthropic_api_key: Optional[str] = Field(default=None)
    anthropic_base_url: Optional[str] = Field(default=None)
    anthropic_api_key_helper: Optional[str] = Field(default=None)
    anthropic_ca_cert: Optional[str] = Field(default=None)
    claude_model: str = Field(default="claude-opus-4-8")
    claude_max_tokens: int = Field(default=2048)
    # Note: some gateway-hosted models only accept temperature=1. Determinism is
    # enforced in Python (hard constraints/tools), so narrative temperature is non-critical.
    claude_temperature: float = Field(default=1.0)

    # Multi-agent orchestration limits
    ai_max_tool_calls: int = Field(default=8)
    ai_recursion_limit: int = Field(default=12)
    ai_request_timeout_seconds: int = Field(default=30)
    ai_enable_memory: bool = Field(default=True)

    # Email (Mailpit)
    mail_host: str = Field(default="localhost")
    mail_port: int = Field(default=1025)
    mail_from: str = Field(default="notifications@driveedge.local")

    # Auth
    auth_secret: str = Field(default="dev-only-insecure-secret-change-me")
    access_token_expire_minutes: int = Field(default=30)
    refresh_token_expire_days: int = Field(default=7)
    jwt_algorithm: str = Field(default="HS256")

    # CORS
    cors_origins: str = Field(default="http://localhost:3000")

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        """True when either a direct API key or a gateway+helper is configured."""
        if self.anthropic_api_key:
            return True
        return bool(self.anthropic_base_url and self.anthropic_api_key_helper)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
