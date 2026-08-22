"""AI Mastery Hub — API entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import seed
from .models import DayPlan, DayPlanActivity
from .config import settings
from .database import Base, SessionLocal, engine
from sqlalchemy import text
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
    for table in ("day_plans", "checklist_items"):
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN started BOOLEAN NOT NULL DEFAULT FALSE"))
        except Exception:
            # Column already exists on databases that were created after the migration.
            pass
    with SessionLocal() as db:
        seed.run(db)
        activity_sets = {
            "Exercism · los tres primeros del track": [
                ("Guido's Gorgeous Lasagna", 25, "https://exercism.org/tracks/python/exercises/lasagna"),
                ("Ghost Gobble", 25, "https://exercism.org/tracks/python/exercises/ghost-gobble-arcade-game"),
                ("Currency Exchange", 25, "https://exercism.org/tracks/python/exercises/currency-exchange"),
            ],
            "LangChain Essentials · lecciones 1–5 y 7": [
                ("Create Agent", 18, "https://academy.langchain.com/courses/langchain-essentials-python"),
                ("Models and Messages", 18, "https://academy.langchain.com/courses/langchain-essentials-python"),
                ("Streaming", 18, "https://academy.langchain.com/courses/langchain-essentials-python"),
                ("Tools", 18, "https://academy.langchain.com/courses/langchain-essentials-python"),
                ("Structured Output", 18, "https://academy.langchain.com/courses/langchain-essentials-python"),
            ],
            "Richards · lecciones 161 y 159": [
                ("Lección 161 · Agility and Monolithic Architectures", 30, "https://www.developertoarchitect.com/lessons/"),
                ("Lección 159 · Modular Monolith Architecture", 30, "https://www.developertoarchitect.com/lessons/"),
            ],
        }
        for title, specs in activity_sets.items():
            plan = db.query(DayPlan).filter(DayPlan.title == title).first()
            if plan and not plan.activities:
                plan.activities = [
                    DayPlanActivity(title=name, minutes=minutes, url=url, sort_order=index)
                    for index, (name, minutes, url) in enumerate(specs)
                ]
        db.commit()
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
