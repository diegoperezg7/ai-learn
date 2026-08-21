"""Derived metrics: hours, pace, streaks, task windows.

Hours always come from StudySession rows so there is one source of truth.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import InterviewQuestion, Skill, StudySession, Task, WeeklyReview

DONE_STATUSES = {"Completed", "Interview Ready"}


def today() -> date:
    return date.today()


def task_window(task: Task, ref: date | None = None) -> str:
    ref = ref or today()
    if not task.start_date or not task.deadline:
        return "Unscheduled"
    if task.start_date <= ref <= task.deadline:
        return "Now"
    if task.start_date > ref:
        return "Upcoming"
    return "Past"


def hours_for_task(db: Session, task_id: int) -> float:
    total = db.scalar(
        select(func.coalesce(func.sum(StudySession.minutes), 0)).where(StudySession.task_id == task_id)
    )
    return round((total or 0) / 60, 2)


def hours_by_task(db: Session) -> dict[int, float]:
    rows = db.execute(
        select(StudySession.task_id, func.sum(StudySession.minutes))
        .where(StudySession.task_id.is_not(None))
        .group_by(StudySession.task_id)
    ).all()
    return {tid: round(mins / 60, 2) for tid, mins in rows}


def hours_between(db: Session, start: date, end: date) -> float:
    total = db.scalar(
        select(func.coalesce(func.sum(StudySession.minutes), 0)).where(
            StudySession.day >= start, StudySession.day <= end
        )
    )
    return round((total or 0) / 60, 2)


def total_hours(db: Session) -> float:
    total = db.scalar(select(func.coalesce(func.sum(StudySession.minutes), 0)))
    return round((total or 0) / 60, 2)


def hours_by_skill(db: Session) -> dict[int, float]:
    """Attribute session time to every skill linked to the session's task."""
    result: dict[int, float] = {}
    per_task = hours_by_task(db)
    if not per_task:
        return result
    tasks = db.scalars(select(Task).where(Task.id.in_(per_task.keys()))).unique().all()
    for task in tasks:
        share = per_task.get(task.id, 0)
        if not task.skills or not share:
            continue
        slice_ = round(share / len(task.skills), 2)
        for skill in task.skills:
            result[skill.id] = round(result.get(skill.id, 0) + slice_, 2)
    return result


def current_review(db: Session, ref: date | None = None) -> WeeklyReview | None:
    ref = ref or today()
    reviews = db.scalars(select(WeeklyReview).order_by(WeeklyReview.id)).all()
    for review in reviews:
        if review.start_date and review.end_date and review.start_date <= ref <= review.end_date:
            return review
    # Before the sprint starts, point at the first week.
    upcoming = [r for r in reviews if r.start_date and r.start_date > ref]
    return upcoming[0] if upcoming else (reviews[-1] if reviews else None)


def week_bounds(ref: date | None = None) -> tuple[date, date]:
    ref = ref or today()
    start = ref - timedelta(days=ref.weekday())
    return start, start + timedelta(days=6)


def streak_days(db: Session, ref: date | None = None) -> int:
    """Consecutive days with logged time, counting back from today (or yesterday)."""
    ref = ref or today()
    days = set(
        db.scalars(
            select(StudySession.day).where(StudySession.minutes > 0).distinct()
        ).all()
    )
    if not days:
        return 0
    cursor = ref if ref in days else ref - timedelta(days=1)
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def pace(db: Session, ref: date | None = None) -> tuple[str, float]:
    """Compare logged hours against the expected linear pace since sprint start."""
    ref = ref or today()
    if ref < settings.sprint_start:
        return "not-started", 0.0
    elapsed_days = (ref - settings.sprint_start).days + 1
    expected = (elapsed_days / 7) * settings.weekly_target_hours
    actual = total_hours(db)
    delta = round(actual - expected, 1)
    if delta >= 1.5:
        return "ahead", delta
    if delta <= -3:
        return "behind", delta
    return "on-track", delta


def interview_counts(db: Session) -> tuple[int, int]:
    questions = db.scalars(select(InterviewQuestion)).all()
    ready = sum(1 for q in questions if q.can_explain and q.can_implement)
    return ready, len(questions)


def skill_rollups(db: Session) -> dict[int, dict[str, float]]:
    """Per-skill task/question/hour counters used by the Skills page."""
    per_skill_hours = hours_by_skill(db)
    out: dict[int, dict[str, float]] = {}
    for skill in db.scalars(select(Skill)).unique().all():
        tasks = skill.tasks
        questions = skill.questions
        out[skill.id] = {
            "tasks_total": len(tasks),
            "tasks_done": sum(1 for t in tasks if t.status in DONE_STATUSES),
            "questions_total": len(questions),
            "questions_ready": sum(1 for q in questions if q.can_explain and q.can_implement),
            "hours_logged": per_skill_hours.get(skill.id, 0.0),
        }
    return out
