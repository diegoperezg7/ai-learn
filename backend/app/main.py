"""AI Mastery Hub — API entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import seed
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .dependencies import CurrentUser, get_current_user
from .routers import growth, plan, skills, tasks, tracking
from .services import notifier, plan_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("hub")


# Lightweight additive migrations for databases created before a column existed.
_COLUMN_MIGRATIONS = (
    ("day_plans", "ALTER TABLE day_plans ADD COLUMN started BOOLEAN NOT NULL DEFAULT FALSE"),
    ("checklist_items", "ALTER TABLE checklist_items ADD COLUMN started BOOLEAN NOT NULL DEFAULT FALSE"),
    ("weekly_reviews", "ALTER TABLE weekly_reviews ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"),
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.database_url.startswith("sqlite:///"):
        db_path = Path(settings.database_url.replace("sqlite:///", "", 1))
        db_path.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)
    for _table, ddl in _COLUMN_MIGRATIONS:
        try:
            with engine.begin() as conn:
                conn.execute(text(ddl))
        except Exception:
            # Column already exists on databases created after the migration.
            pass

    with SessionLocal() as db:
        # Bootstrap-only: seeds an empty database once, never overwrites edits.
        seed.bootstrap(db)
        notifier.refresh(db)
        cfg = plan_settings.load(db)
    log.info("AI Mastery Hub listo. Plan %s -> %s", cfg.start_date, cfg.core_deadline)
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

for router in (skills.router, tasks.router, tracking.router, growth.router, plan.router):
    app.include_router(router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/auth/me")
def me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {"name": user.name, "email": user.email, "role": user.role}


@app.get("/api/config")
def client_config(db: Session = Depends(get_db)) -> dict:
    cfg = plan_settings.load(db)
    return {
        "sprint_start": cfg.start_date.isoformat(),
        "core_deadline": cfg.core_deadline.isoformat(),
        "final_deadline": cfg.final_deadline.isoformat(),
        "weekly_target_hours": cfg.weekly_target_hours,
        "rest_weekdays": sorted(cfg.rest_weekdays),
        "coach_enabled": settings.coach_enabled,
        "ollama_model": settings.ollama_model,
    }
