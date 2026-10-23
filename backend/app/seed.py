"""Idempotent database seeding. Safe to run on every boot."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    ChecklistItem,
    DayPlan,
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
    for label, number, start, end, phase in WEEKS:
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


def repair_seeded_plan_dates(db: Session) -> None:
    """Restore the canonical calendar for unfinished seeded sessions only."""
    plans = db.scalars(select(DayPlan).where(DayPlan.done.is_(False))).all()
    # The earlier buggy compactor put later-week sessions on today's date. Only
    # repair that unmistakable shape; normal adaptive schedules are untouched.
    if not plans or not any(plan.day == date.today() and (plan.week or 0) >= 3 for plan in plans):
        return
    by_week_title = {(plan.week, plan.title): plan for plan in plans if plan.week is not None}
    for _label, number, start, _end, _phase in WEEKS:
        if number is None or number not in WEEK_PLANS:
            continue
        rows = list(WEEK_PLANS[number])
        offset, minutes, mode, title, scope = REVIEW_SESSION
        rows.append((offset, minutes, mode, f"{title} S{number}", scope, f"Weekly Review S{number}", ""))
        week_start = date.fromisoformat(start)
        for slot, (day_offset, _mins, _mode, session_title, *_rest) in enumerate(rows):
            plan = by_week_title.get((number, session_title))
            if plan:
                plan.day = week_start + timedelta(days=day_offset)
                plan.slot = slot
    db.flush()


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
