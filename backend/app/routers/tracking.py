"""Time logging, weekly reviews, notifications and the dashboard aggregate."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import DayPlan, InterviewQuestion, Notification, Skill, StudySession, Task, WeeklyReview
from ..schemas import (
    CategoryStat,
    DashboardOut,
    DayPlanOut,
    DayPlanUpdate,
    NotificationOut,
    SessionCreate,
    SessionOut,
    WeeklyReviewOut,
    WeeklyReviewUpdate,
    WeekHours,
)
from ..services import notifier, progress

router = APIRouter(tags=["tracking"])


# ------------------------------------------------------------------ day plan


@router.get("/days", response_model=list[DayPlanOut])
def list_days(
    day: date | None = None,
    week: int | None = None,
    db: Session = Depends(get_db),
) -> list[DayPlan]:
    stmt = select(DayPlan).order_by(DayPlan.day, DayPlan.slot)
    if day is not None:
        stmt = stmt.where(DayPlan.day == day)
    if week is not None:
        stmt = stmt.where(DayPlan.week == week)
    return db.scalars(stmt).unique().all()


@router.patch("/days/{plan_id}", response_model=DayPlanOut)
def update_day(plan_id: int, payload: DayPlanUpdate, db: Session = Depends(get_db)) -> DayPlan:
    plan = db.get(DayPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Sesion no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/days/{plan_id}/complete", response_model=DayPlanOut)
def complete_day(plan_id: int, minutes: int | None = None, db: Session = Depends(get_db)) -> DayPlan:
    """Tick a session off and log its time in one go, so hours never drift from the plan."""
    plan = db.get(DayPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Sesion no encontrada")
    if not plan.done:
        plan.done = True
        db.add(
            StudySession(
                day=plan.day,
                minutes=minutes or plan.minutes,
                task_id=plan.task_id,
                mode=plan.mode,
                notes=plan.title,
            )
        )
        db.commit()
        db.refresh(plan)
    return plan


@router.post("/days/{plan_id}/start", response_model=DayPlanOut)
def start_day(plan_id: int, db: Session = Depends(get_db)) -> DayPlan:
    plan = db.get(DayPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Sesion no encontrada")
    if not plan.done:
        plan.started = True
        db.commit()
        db.refresh(plan)
    return plan


# ------------------------------------------------------------------ sessions


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(limit: int = 100, db: Session = Depends(get_db)) -> list[SessionOut]:
    rows = db.scalars(
        select(StudySession).order_by(StudySession.day.desc(), StudySession.id.desc()).limit(limit)
    ).all()
    out = []
    for row in rows:
        item = SessionOut.model_validate(row)
        item.task_title = row.task.title if row.task else None
        out.append(item)
    return out


@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionOut:
    if payload.minutes <= 0:
        raise HTTPException(400, "Los minutos deben ser mayores que cero")
    session = StudySession(
        day=payload.day or progress.today(),
        minutes=payload.minutes,
        task_id=payload.task_id,
        mode=payload.mode,
        used_ai=payload.used_ai,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    result = SessionOut.model_validate(session)
    result.task_title = session.task.title if session.task else None
    return result


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)) -> None:
    session = db.get(StudySession, session_id)
    if not session:
        raise HTTPException(404, "Sesion no encontrada")
    db.delete(session)
    db.commit()


@router.get("/sessions/heatmap")
def heatmap(days: int = 120, db: Session = Depends(get_db)) -> list[dict]:
    """Per-day minutes for the contribution-style calendar."""
    end = progress.today()
    start = end - timedelta(days=days - 1)
    rows = db.execute(
        select(StudySession.day, func.sum(StudySession.minutes))
        .where(StudySession.day >= start, StudySession.day <= end)
        .group_by(StudySession.day)
    ).all()
    logged = {day: minutes for day, minutes in rows}
    return [
        {"day": (start + timedelta(days=i)).isoformat(), "minutes": logged.get(start + timedelta(days=i), 0)}
        for i in range((end - start).days + 1)
    ]


# ------------------------------------------------------------------ reviews


def _review_out(review: WeeklyReview, db: Session, ref: date) -> WeeklyReviewOut:
    data = WeeklyReviewOut.model_validate(review)
    if review.start_date and review.end_date:
        data.actual_hours = progress.hours_between(db, review.start_date, review.end_date)
        data.is_current = review.start_date <= ref <= review.end_date
    data.adherence = round(data.actual_hours / review.target_hours, 2) if review.target_hours else 0
    return data


@router.get("/reviews", response_model=list[WeeklyReviewOut])
def list_reviews(db: Session = Depends(get_db)) -> list[WeeklyReviewOut]:
    ref = progress.today()
    reviews = db.scalars(select(WeeklyReview).order_by(WeeklyReview.start_date, WeeklyReview.id)).all()
    return [_review_out(r, db, ref) for r in reviews]


@router.patch("/reviews/{review_id}", response_model=WeeklyReviewOut)
def update_review(review_id: int, payload: WeeklyReviewUpdate, db: Session = Depends(get_db)) -> WeeklyReviewOut:
    review = db.get(WeeklyReview, review_id)
    if not review:
        raise HTTPException(404, "Review no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    db.commit()
    db.refresh(review)
    return _review_out(review, db, progress.today())


# ------------------------------------------------------------------ notifications


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db)) -> list[Notification]:
    stmt = select(Notification).order_by(Notification.created_at.desc()).limit(50)
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))
    return db.scalars(stmt).all()


@router.post("/notifications/refresh")
def refresh_notifications(db: Session = Depends(get_db)) -> dict:
    created = notifier.refresh(db)
    unread = db.scalar(select(func.count(Notification.id)).where(Notification.read.is_(False))) or 0
    return {"created": created, "unread": unread}


@router.post("/notifications/{notification_id}/read", status_code=204)
def mark_read(notification_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(Notification, notification_id)
    if not item:
        raise HTTPException(404, "Notificacion no encontrada")
    item.read = True
    db.commit()


@router.post("/notifications/read-all", status_code=204)
def mark_all_read(db: Session = Depends(get_db)) -> None:
    for item in db.scalars(select(Notification).where(Notification.read.is_(False))).all():
        item.read = True
    db.commit()


# ------------------------------------------------------------------ dashboard


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)) -> DashboardOut:
    ref = progress.today()
    progress.rollover_overdue_plans(db, ref)
    tasks = db.scalars(select(Task)).unique().all()
    real_tasks = [t for t in tasks if t.phase != "Break"]

    done = [t for t in real_tasks if t.status in progress.DONE_STATUSES]
    week_tasks = [t for t in real_tasks if progress.task_window(t, ref) == "Now"]
    week_done = [t for t in week_tasks if t.status in progress.DONE_STATUSES]

    review = progress.current_review(db, ref)
    if review and review.start_date and review.end_date:
        hours_week = progress.hours_between(db, review.start_date, review.end_date)
        week_label = review.label
        phase = review.phase
        current_week = review.week_number
    else:
        start, end = progress.week_bounds(ref)
        hours_week = progress.hours_between(db, start, end)
        week_label = f"{start:%d %b} – {end:%d %b}"
        phase = "Pre-sprint"
        current_week = None

    pace_status, pace_delta = progress.pace(db, ref)
    ready, total_q = progress.interview_counts(db)

    skills = db.scalars(select(Skill)).unique().all()
    by_status: dict[str, int] = defaultdict(int)
    for skill in skills:
        by_status[skill.status] += 1

    # Planned vs logged hours per pillar.
    # "Optional / Filler" never runs unless there is spare room, and "Meta / Review"
    # is overhead, not a learning pillar. Counting either distorts the 40/30/20/10 split.
    # Scoped to the 12-week sprint: that is where the 40/30/20/10 hierarchy applies.
    # December is deliberately Models-heavy and would swamp the split.
    pillar_tasks = [t for t in real_tasks if t.phase == "Sprint 12w" and t.category != "Meta / Review"]
    pillars = ["AI Engineering", "Software Engineering", "Cloud / Infra", "Models / ML"]
    planned: dict[str, float] = defaultdict(float, {p: 0.0 for p in pillars})
    logged: dict[str, float] = defaultdict(float, {p: 0.0 for p in pillars})
    per_task_hours = progress.hours_by_task(db)
    for task in pillar_tasks:
        planned[task.category] += task.estimated_hours or 0
        logged[task.category] += per_task_hours.get(task.id, 0)
    planned_total = sum(planned.values()) or 1
    category_stats = [
        CategoryStat(
            category=cat,
            planned_hours=round(planned[cat], 1),
            logged_hours=round(logged.get(cat, 0), 1),
            share=round(planned[cat] / planned_total * 100, 1),
        )
        for cat in sorted(planned, key=lambda c: -planned[c])
    ]

    week_hours = []
    for rev in db.scalars(select(WeeklyReview).order_by(WeeklyReview.start_date)).all():
        if rev.week_number is None or not rev.start_date or not rev.end_date:
            continue
        week_hours.append(
            WeekHours(
                week=rev.week_number,
                label=rev.label.split(" — ")[0],
                target=rev.target_hours,
                actual=progress.hours_between(db, rev.start_date, rev.end_date),
            )
        )

    upcoming = sorted(
        (t for t in real_tasks if t.deadline and t.deadline >= ref and t.status not in progress.DONE_STATUSES),
        key=lambda t: t.deadline,
    )
    next_milestone = upcoming[0].deliverable or upcoming[0].title if upcoming else "Sprint completado"

    unread = db.scalar(select(func.count(Notification.id)).where(Notification.read.is_(False))) or 0

    today_plan = db.scalars(
        select(DayPlan).where(DayPlan.day == ref).order_by(DayPlan.slot)
    ).unique().all()
    questions_due = db.scalar(
        select(func.count(InterviewQuestion.id)).where(
            InterviewQuestion.next_review.is_not(None), InterviewQuestion.next_review <= ref
        )
    ) or 0

    return DashboardOut(
        today=ref,
        sprint_start=settings.sprint_start,
        core_deadline=settings.core_deadline,
        final_deadline=settings.final_deadline,
        days_to_core=(settings.core_deadline - ref).days,
        current_week=current_week,
        current_week_label=week_label,
        phase=phase,
        tasks_total=len(real_tasks),
        tasks_done=len(done),
        completion=round(len(done) / len(real_tasks) * 100, 1) if real_tasks else 0,
        week_tasks_total=len(week_tasks),
        week_tasks_done=len(week_done),
        hours_this_week=hours_week,
        weekly_target=settings.weekly_target_hours,
        hours_total=progress.total_hours(db),
        pace_status=pace_status,
        pace_delta_hours=pace_delta,
        streak_days=progress.streak_days(db, ref),
        interview_ready=ready,
        interview_total=total_q,
        skills_by_status=dict(by_status),
        category_stats=category_stats,
        week_hours=week_hours,
        next_milestone=next_milestone,
        unread_notifications=int(unread),
        today_plan=[DayPlanOut.model_validate(p) for p in today_plan],
        today_minutes_done=sum(p.minutes for p in today_plan if p.done),
        today_minutes_planned=sum(p.minutes for p in today_plan),
        questions_due=int(questions_due),
    )
