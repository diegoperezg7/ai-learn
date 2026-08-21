"""Rule-based notifications. Recomputed on demand; deduped by key."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Notification, StudySession, Task
from . import progress


def _push(db: Session, key: str, level: str, title: str, body: str) -> bool:
    if db.scalar(select(Notification.id).where(Notification.key == key).limit(1)):
        return False
    db.add(Notification(key=key, level=level, title=title, body=body))
    return True


def refresh(db: Session, ref: date | None = None) -> int:
    """Evaluate every rule for `ref`. Returns how many notifications were created."""
    ref = ref or progress.today()
    stamp = ref.isoformat()
    created = 0

    # 1. Deadlines landing today
    due_today = db.scalars(
        select(Task).where(Task.deadline == ref, Task.status.not_in(list(progress.DONE_STATUSES)))
    ).unique().all()
    for task in due_today:
        created += _push(
            db,
            f"due:{task.id}:{stamp}",
            "warning",
            f"Vence hoy: {task.title}",
            task.deliverable or "Sin entregable definido.",
        )

    # 2. Overdue
    overdue = db.scalars(
        select(Task).where(Task.deadline < ref, Task.status.not_in(list(progress.DONE_STATUSES)))
    ).unique().all()
    if overdue:
        created += _push(
            db,
            f"overdue:{stamp}:{len(overdue)}",
            "danger",
            f"{len(overdue)} tarea(s) atrasada(s)",
            ", ".join(t.title for t in overdue[:5]),
        )

    # 3. Pace
    status, delta = progress.pace(db, ref)
    if status == "behind":
        created += _push(
            db,
            f"pace-behind:{stamp}",
            "danger",
            f"Vas {abs(delta):.1f} h por detras del ritmo",
            "Recorta alcance o sube 30 min al dia. No metas una jornada doble.",
        )
    elif status == "ahead":
        created += _push(
            db,
            f"pace-ahead:{stamp}",
            "success",
            f"Vas {delta:.1f} h por delante",
            "Buen momento para tocar una tarea Optional, o para descansar.",
        )

    # 4. No focus picked for today
    if ref >= settings.sprint_start:
        focused = db.scalar(select(Task.id).where(Task.today_focus.is_(True)).limit(1))
        if not focused:
            created += _push(
                db,
                f"nofocus:{stamp}",
                "info",
                "No has elegido el foco de hoy",
                "Marca 1-3 tareas como foco. Nunca mas de 3.",
            )

    # 5. Weekly review due on the last day of the week block
    review = progress.current_review(db, ref)
    if review and review.end_date == ref and not review.done:
        created += _push(
            db,
            f"review:{review.id}",
            "warning",
            f"Toca cerrar la review de {review.label}",
            "Sin review no hay correccion de rumbo.",
        )

    # 6. Streak milestones
    streak = progress.streak_days(db, ref)
    if streak in {7, 14, 21, 30, 60, 90}:
        created += _push(
            db, f"streak:{streak}", "success", f"{streak} dias seguidos", "Consistencia, que es de lo que iba esto."
        )

    # 7. Rest-day guard: 7 consecutive days without a day off
    last_7 = [ref - timedelta(days=i) for i in range(7)]
    logged = set(db.scalars(select(StudySession.day).distinct()).all())
    if all(d in logged for d in last_7):
        created += _push(
            db,
            f"rest:{stamp}",
            "warning",
            "Llevas 7 dias sin descansar",
            "El plan exige minimo 1 dia libre por semana. Coge uno.",
        )

    if created:
        db.commit()
    return created
