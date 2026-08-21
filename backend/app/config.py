"""Application configuration, read from environment."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date


def _env(key: str, default: str) -> str:
    return os.getenv(key, default)


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_date(key: str, default: str) -> date:
    return date.fromisoformat(_env(key, default))


@dataclass(frozen=True)
class Settings:
    app_name: str = "AI-Learn"
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./data/hub.db"))
    database_schema: str = field(default_factory=lambda: _env("DATABASE_SCHEMA", "public"))

    # Portal integration. When the app sits behind darc3 auth-proxy, Caddy injects X-Auth-* headers.
    require_portal_auth: bool = field(default_factory=lambda: _env_bool("REQUIRE_PORTAL_AUTH", False))
    dev_user_name: str = field(default_factory=lambda: _env("DEV_USER_NAME", "Diego Perez Garcia"))
    dev_user_email: str = field(default_factory=lambda: _env("DEV_USER_EMAIL", "diegoperezgarc@gmail.com"))

    cors_origins: str = field(default_factory=lambda: _env("CORS_ORIGINS", "http://localhost:5183,http://127.0.0.1:5183"))

    # Roadmap calendar
    sprint_start: date = field(default_factory=lambda: _env_date("SPRINT_START", "2026-08-21"))
    core_deadline: date = field(default_factory=lambda: _env_date("CORE_DEADLINE", "2026-11-29"))
    final_deadline: date = field(default_factory=lambda: _env_date("FINAL_DEADLINE", "2026-12-31"))
    weekly_target_hours: float = field(default_factory=lambda: float(_env("WEEKLY_TARGET_HOURS", "6")))

    # Local LLM coach
    ollama_url: str = field(default_factory=lambda: _env("OLLAMA_URL", "http://host.docker.internal:11434"))
    ollama_model: str = field(default_factory=lambda: _env("OLLAMA_MODEL", "qwen2.5:7b"))
    coach_enabled: bool = field(default_factory=lambda: _env_bool("COACH_ENABLED", True))

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
