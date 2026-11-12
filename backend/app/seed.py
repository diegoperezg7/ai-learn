"""Idempotent database seeding. Safe to run on every boot."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    ChecklistItem,
    DayPlan,
    DayPlanActivity,
    CVDocument,
    InterviewQuestion,
    Resource,
    Skill,
    Task,
    WeeklyReview,
)
from .seed_data import RESOURCES, SKILLS
from .seed_days import REVIEW_SESSION, WEEK_PLANS
from .seed_plan import PHASE_DATES, QUESTIONS, TASKS, WEEKS

# week number -> (start, end). Task dates are derived from this so the calendar
# lives in exactly one place.
WEEK_BOUNDS: dict[int, tuple[str, str]] = {n: (s, e) for _, n, s, e, _ in WEEKS if n is not None}

CV_SOURCES = [
    Path("/app/import/cv.md"),
    Path(__file__).resolve().parents[2] / "import" / "cv.md",
]

FALLBACK_CV = """# Diego Perez Garcia

**AI Engineer | Production AI Systems | RAG, LLM Agents and Intelligent Automation**

## Profile

AI Engineer specialized in designing, building and deploying production-grade AI systems end-to-end.

## Experience

## Technical Skills

## Projects

## Education

## Languages
"""


def _parse(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def seed_skills(db: Session) -> dict[str, Skill]:
    existing = {s.slug: s for s in db.scalars(select(Skill)).unique().all()}
    for order, spec in enumerate(SKILLS):
        skill = existing.get(spec["slug"])
        if skill is None:
            skill = Skill(**spec, sort_order=order)
            db.add(skill)
            existing[spec["slug"]] = skill
    db.commit()
    return {s.slug: s for s in db.scalars(select(Skill)).unique().all()}


def seed_resources(db: Session, skills: dict[str, Skill]) -> dict[str, Resource]:
    existing = {r.name: r for r in db.scalars(select(Resource)).unique().all()}
    for spec in RESOURCES:
        if spec["name"] in existing:
            # Correct canonical links without touching user status, notes or history.
            existing[spec["name"]].url = spec.get("url", existing[spec["name"]].url)
            continue
        data = {k: v for k, v in spec.items() if k != "skills"}
        data.setdefault("free_access", data.get("price", "Free") != "Paid")
        resource = Resource(**data)
        resource.skills = [skills[s] for s in spec.get("skills", []) if s in skills]
        db.add(resource)
    db.commit()
    return {r.name: r for r in db.scalars(select(Resource)).unique().all()}


def _task_dates(spec: dict) -> tuple[date | None, date | None]:
    """Derive a task's window from its week, falling back to its phase."""
    week = spec.get("week")
    if week is not None and week in WEEK_BOUNDS:
        start, end = WEEK_BOUNDS[week]
        # A weekly review only happens on the closing day.
        if spec["title"].startswith("Weekly Review"):
            return _parse(end), _parse(end)
        return _parse(start), _parse(end)

    phase = spec.get("phase", "Sprint 12w")
    if phase in PHASE_DATES:
        start, end = PHASE_DATES[phase]
        return _parse(start), _parse(end)

    # Optional / Filler stays deliberately unscheduled.
    return _parse(spec.get("start")), _parse(spec.get("deadline"))


def seed_tasks(db: Session, skills: dict[str, Skill], resources: dict[str, Resource]) -> None:
    existing = {t.title + str(t.week) for t in db.scalars(select(Task)).unique().all()}
    for order, spec in enumerate(TASKS):
        key = spec["title"] + str(spec.get("week"))
        if key in existing:
            continue
        start_date, deadline = _task_dates(spec)
        task = Task(
            title=spec["title"],
            category=spec["category"],
            phase=spec.get("phase", "Sprint 12w"),
            week=spec.get("week"),
            start_date=start_date,
            deadline=deadline,
            priority=spec.get("priority", "Medium"),
            estimated_hours=spec.get("hours", 0),
            mode=spec.get("mode", "Practice"),
            deliverable=spec.get("deliverable", ""),
            interview_relevant=spec.get("category") != "Meta / Review",
            sort_order=order,
        )
        task.skills = [skills[s] for s in spec.get("skills", []) if s in skills]
        task.resources = [resources[r] for r in spec.get("resources", []) if r in resources]
        for idx, text in enumerate(spec.get("checklist", [])):
            task.checklist.append(ChecklistItem(text=text, sort_order=idx))
        db.add(task)
        existing.add(key)
    db.commit()


def seed_reviews(db: Session) -> None:
    existing = {r.label for r in db.scalars(select(WeeklyReview)).all()}
    for order, (label, number, start, end, phase) in enumerate(WEEKS):
        if label in existing:
            continue
        db.add(
            WeeklyReview(
                label=label,
                week_number=number,
                start_date=_parse(start),
                end_date=_parse(end),
                phase=phase,
                target_hours=0 if phase == "Break" else 6,
                sort_order=order,
                done=phase == "Break",
            )
        )
    db.commit()


def seed_questions(db: Session, skills: dict[str, Skill]) -> None:
    existing = {q.question for q in db.scalars(select(InterviewQuestion)).all()}
    for text, area, difficulty, slug in QUESTIONS:
        if text in existing:
            continue
        db.add(
            InterviewQuestion(
                question=text,
                area=area,
                difficulty=difficulty,
                skill_id=skills[slug].id if slug and slug in skills else None,
            )
        )
    db.commit()


def seed_days(db: Session, tasks_by_title: dict[str, Task], resources: dict[str, Resource]) -> None:
    """Lay every week's sessions on real calendar days."""
    if db.scalar(select(DayPlan.id).limit(1)):
        return

    for label, number, start, _end, _phase in WEEKS:
        if number is None or number not in WEEK_PLANS:
            continue
        week_start = date.fromisoformat(start)

        rows = list(WEEK_PLANS[number])
        offset, minutes, mode, title, scope = REVIEW_SESSION
        review_title = f"Weekly Review S{number}"
        rows.append((offset, minutes, mode, f"{title} S{number}", scope, review_title, ""))

        for slot, (day_offset, mins, session_mode, session_title, scope_text, task_title, resource_name) in enumerate(rows):
            task = tasks_by_title.get(task_title)
            db.add(
                DayPlan(
                    day=week_start + timedelta(days=day_offset),
                    week=number,
                    slot=slot,
                    title=session_title,
                    scope=scope_text,
                    minutes=mins,
                    mode=session_mode,
                    task_id=task.id if task else None,
                    resource_id=resources[resource_name].id if resource_name in resources else None,
                )
            )
    db.commit()


def seed_cv(db: Session) -> None:
    if db.scalar(select(CVDocument).limit(1)):
        return
    content = FALLBACK_CV
    for path in CV_SOURCES:
        try:
            if path.is_file():
                text = path.read_text(encoding="utf-8").strip()
                if text:
                    content = text + "\n"
                    break
        except OSError:
            continue
    db.add(CVDocument(content=content))
    db.commit()


def run(db: Session) -> None:
    skills = seed_skills(db)
    resources = seed_resources(db, skills)
    seed_tasks(db, skills, resources)
    seed_reviews(db)
    seed_questions(db, skills)
    tasks_by_title = {t.title: t for t in db.scalars(select(Task)).unique().all()}
    seed_days(db, tasks_by_title, resources)
    seed_cv(db)


# ------------------------------------------------------------------ bootstrap

# Child activities and sharpened scopes for a handful of sessions. One-time
# enrichment applied only when a fresh database is first seeded.
_ACTIVITY_SETS: dict[str, list[tuple[str, int, str]]] = {
    "Exercism · los tres primeros del track": [
        ("Guido's Gorgeous Lasagna", 25, "https://exercism.org/tracks/python/exercises/lasagna"),
        ("Ghost Gobble", 25, "https://exercism.org/tracks/python/exercises/ghost-gobble-arcade-game"),
        ("Currency Exchange", 25, "https://exercism.org/tracks/python/exercises/currency-exchange"),
    ],
    "Richards · lecciones 161 y 159": [
        ("Lección 161 · Agility and Monolithic Architectures", 30, "https://www.developertoarchitect.com/lessons/"),
        ("Lección 159 · Modular Monolith Architecture", 30, "https://www.developertoarchitect.com/lessons/"),
    ],
    "Richards · lección 162 + tu tabla": [
        ("Lección 162 · Microservices Architecture", 25, "https://www.developertoarchitect.com/lessons/"),
        ("Tabla de trade-offs: cuándo elegir cada estilo", 20, "https://www.developertoarchitect.com/lessons/"),
    ],
    "Richards · lección 131 + los 4 estilos restantes": [
        ("Lección 131 · Microservices vs Event-Driven", 25, "https://www.developertoarchitect.com/lessons/"),
        ("Layered, Clean, Hexagonal y Event-Driven", 35, "https://www.developertoarchitect.com/lessons/"),
    ],
    "Top-K vs Top-P y KV cache": [
        ("Medir TTFT e inter-token latency", 20, ""),
        ("Explicar conceptualmente KV cache", 20, ""),
        ("Separar observación empírica de causalidad", 20, ""),
    ],
    "Quantization y VRAM de tus modelos": [
        ("Calcular 7B × bits por parámetro", 25, ""),
        ("Distinguir weights, KV cache y runtime overhead", 25, ""),
        ("Comparar con memoria observada en Ollama", 25, ""),
        ("Explicar por qué no coinciden exactamente", 45, ""),
    ],
}

_SCOPE_UPDATES: dict[str, str] = {
    "Top-K vs Top-P y KV cache": "Compara Top-K y Top-P en Ollama. Mide Time To First Token e inter-token latency. Explica conceptualmente cómo KV cache evita recalcular K/V anteriores y separa la observación empírica de la explicación causal.",
    "Quantization y VRAM de tus modelos": "Distingue model weights, RAM/VRAM residente, KV cache, context length y runtime overhead. Calcula 7B × bits por parámetro y contrástalo con la memoria realmente observada en Ollama; explica por qué no coincide exactamente.",
    "Richards · lección 131 + los 4 estilos restantes": "Lección 131 · Microservices vs Event-Driven Architecture. Distingue distribución/deployment boundaries (monolith vs microservices) de organización interna y dependencias (layered, clean, hexagonal, event-driven), y resume el trade-off de cada una.",
}


def _enrich_sessions(db: Session) -> None:
    for title, specs in _ACTIVITY_SETS.items():
        plan = db.query(DayPlan).filter(DayPlan.title == title).first()
        if plan and not plan.activities:
            plan.activities = [
                DayPlanActivity(title=name, minutes=minutes, url=url, sort_order=index)
                for index, (name, minutes, url) in enumerate(specs)
            ]
    for title, scope in _SCOPE_UPDATES.items():
        plan = db.query(DayPlan).filter(DayPlan.title == title).first()
        if plan and not plan.done:
            plan.scope = scope
    db.commit()


def _backfill_review_sort_order(db: Session) -> None:
    """Older databases predate `sort_order`; order the weeks by their dates once."""
    reviews = db.scalars(select(WeeklyReview).order_by(WeeklyReview.start_date, WeeklyReview.id)).all()
    if any(r.sort_order for r in reviews):
        return
    for order, review in enumerate(reviews):
        review.sort_order = order
    db.commit()


def bootstrap(db: Session) -> None:
    """Seed the database exactly once, then never touch user edits again.

    - Already bootstrapped -> return immediately.
    - Pre-existing live database (predates this migration) -> adopt it as-is: only
      write the default plan settings if missing and backfill week ordering.
    - Empty database -> full seed, enrich sessions, write defaults and lay the calendar.
    """
    from .services import plan_settings, scheduler

    if plan_settings.is_seeded(db):
        return

    has_rows = (
        db.scalar(select(Task.id).limit(1)) is not None
        or db.scalar(select(DayPlan.id).limit(1)) is not None
    )
    if has_rows:
        plan_settings.ensure_defaults(db)
        _backfill_review_sort_order(db)
        plan_settings.mark_seeded(db)
        return

    run(db)
    _enrich_sessions(db)
    plan_settings.put_many(db, plan_settings.env_defaults())
    scheduler.regenerate(db, "full")
    plan_settings.mark_seeded(db)
