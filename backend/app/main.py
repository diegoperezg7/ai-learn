"""AI Mastery Hub — API entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import seed
from .config import settings
from .database import Base, SessionLocal, engine
from .dependencies import CurrentUser, get_current_user
from .routers import growth, skills, tasks, tracking
from .services import notifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("hub")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.database_url.startswith("sqlite:///"):
        db_path = Path(settings.database_url.replace("sqlite:///", "", 1))
        db_path.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed.run(db)
        notifier.refresh(db)
    log.info("AI Mastery Hub listo. Sprint %s -> %s", settings.sprint_start, settings.core_deadline)
    yield


app = FastAPI(
    title=settings.app_name,
    description="Technical Career Operating System — AI Engineer Mastery Roadmap 2026",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (skills.router, tasks.router, tracking.router, growth.router):
    app.include_router(router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/auth/me")
def me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {"name": user.name, "email": user.email, "role": user.role}


@app.get("/api/config")
def client_config() -> dict:
    return {
        "sprint_start": settings.sprint_start.isoformat(),
        "core_deadline": settings.core_deadline.isoformat(),
        "final_deadline": settings.final_deadline.isoformat(),
        "weekly_target_hours": settings.weekly_target_hours,
        "coach_enabled": settings.coach_enabled,
        "ollama_model": settings.ollama_model,
    }
