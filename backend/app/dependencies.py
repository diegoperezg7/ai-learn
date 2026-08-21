"""Portal auth. Behind darc3 auth-proxy, Caddy injects X-Auth-* headers via AIdentity."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException, status

from .config import settings


@dataclass(frozen=True)
class CurrentUser:
    name: str
    email: str
    role: str


def get_current_user(
    x_auth_user: str | None = Header(default=None),
    x_auth_email: str | None = Header(default=None),
    x_auth_role: str | None = Header(default=None),
) -> CurrentUser:
    if x_auth_email or x_auth_user:
        return CurrentUser(
            name=x_auth_user or x_auth_email or "unknown",
            email=x_auth_email or "",
            role=x_auth_role or "user",
        )

    if settings.require_portal_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Faltan las cabeceras X-Auth-* del portal.",
        )

    # Local development: single-user app, no login screen.
    return CurrentUser(name=settings.dev_user_name, email=settings.dev_user_email, role="owner")
