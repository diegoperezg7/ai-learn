"""DB-driven calendar generation.

The roadmap used to bake its dates into hardcoded `WEEKS`/`WEEK_PLANS` constants and
"repair" them on every boot. Here the calendar is computed from the database instead,
driven by the editable plan settings (start date, weekly hours, rest days). Two entry
points:

- ``adaptive_dates``: a non-destructive *view* used by ``GET /days`` — it shows pending
  sessions compacted from today without ever mutating the stored dates.
- ``regenerate``: the *persistent* rebuild triggered from the Settings page. It rewrites
  ``WeeklyReview`` bounds, ``DayPlan`` days and ``Task`` windows, while never touching
  anything already completed or any week that has fully closed in the past.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DayPlan, Task, WeeklyReview
from . import plan_settings

# ------------------------------------------------------------------ runtime view


def adaptive_dates(
    plans: list[DayPlan],
    reference: date,
    has_progress_today: bool,
    break_ranges: list[tuple[date, date]],
    rest_weekdays: set[int] | None = None,
) -> dict[int, date]:
    """Return effective dates for pending sessions without mutating the roadmap."""
    rest = rest_weekdays or set()
    pending = sorted((p for p in plans if not p.done), key=lambda p: (p.day, p.slot, p.id))
    if not pending:
        return {}
    cursor = reference if has_progress_today or pending[0].day <= reference else reference + timedelta(days=1)

    def blocked(day: date) -> bool:
        if day.weekday() in rest:
            return True
        return any(start <= day <= end for start, end in break_ranges)

    effective: dict[int, date] = {}
    for plan in pending:
        while blocked(cursor):
            cursor += timedelta(days=1)
        effective[plan.id] = cursor
        cursor += timedelta(days=1)
    return effective


# ------------------------------------------------------------------ persistent rebuild


@dataclass
class RegenerateResult:
    reviews_updated: int
    days_moved: int
    tasks_updated: int


def _ordered_weeks(db: Session) -> list[WeeklyReview]:
    return db.scalars(
        select(WeeklyReview).order_by(WeeklyReview.sort_order, WeeklyReview.start_date, WeeklyReview.id)
    ).all()


def _block_len(review: WeeklyReview) -> int:
    """How many calendar days a week occupies. Breaks keep their real length."""
    if review.phase == "Break" and review.start_date and review.end_date:
        return max(1, (review.end_date - review.start_date).days + 1)
    return 7


def _block_days(block_start: date, length: int, rest: set[int]) -> list[date]:
    """Calendar days of a block, non-rest days first so sessions land on working days."""
    days = [block_start + timedelta(days=i) for i in range(length)]
    working = [d for d in days if d.weekday() not in rest]
    resting = [d for d in days if d.weekday() in rest]
    # Prefer working days; fall back to rest days only if a week has more sessions than
    # working days (keeps every session scheduled instead of dropping any).
    return working + resting


def regenerate(db: Session, mode: str = "from_today") -> RegenerateResult:
    """Rebuild the calendar from the live plan settings.

    ``full``: lay every week from ``start_date``. For a fresh, unstarted plan.
    ``from_today``: freeze everything already done/past, and recompact the remaining
    weeks so they start today. This is the normal "I fell behind, restart from now" path.
    """
    cfg = plan_settings.load(db)
    ref = date.today()
    weeks = _ordered_weeks(db)

    reviews_updated = days_moved = tasks_updated = 0

    # All day plans, grouped by their (current) week number.
    all_days = db.scalars(select(DayPlan)).unique().all()
    days_by_week: dict[int | None, list[DayPlan]] = {}
    for plan in all_days:
        days_by_week.setdefault(plan.week, []).append(plan)

    tasks = db.scalars(select(Task)).unique().all()
    tasks_by_week: dict[int | None, list[Task]] = {}
    for task in tasks:
        tasks_by_week.setdefault(task.week, []).append(task)

    # ``full`` always lays from start_date. ``from_today`` recompacts from today,
    # but honours a start_date set in the future (e.g. "restart from tomorrow").
    cursor = cfg.start_date if mode == "full" else max(ref, cfg.start_date)

    for review in weeks:
        number = review.week_number
        week_days = sorted(days_by_week.get(number, []), key=lambda p: (p.slot, p.id))
        pending = [p for p in week_days if not p.done]

        frozen = (
            mode == "from_today"
            and review.end_date is not None
            and review.end_date < ref
            and not pending
        )
        if frozen:
            # A week fully in the past with nothing left to do: leave it exactly as is.
            continue

        length = _block_len(review)
        block_start = cursor
        block_end = block_start + timedelta(days=length - 1)

        if review.start_date != block_start or review.end_date != block_end:
            review.start_date = block_start
            review.end_date = block_end
            reviews_updated += 1
        new_target = 0.0 if review.phase == "Break" else cfg.weekly_target_hours
        if review.target_hours != new_target:
            review.target_hours = new_target

        # Place pending sessions on the block's days; completed ones keep their past date.
        slots = _block_days(block_start, length, cfg.rest_weekdays)
        for idx, plan in enumerate(pending):
            new_day = slots[idx] if idx < len(slots) else slots[-1]
            if plan.day != new_day:
                plan.day = new_day
                days_moved += 1
            if plan.week != number:
                plan.week = number

        # Re-window the week's tasks. Review tasks land on the closing day.
        for task in tasks_by_week.get(number, []):
            if task.status in ("Completed", "Interview Ready"):
                continue
            if task.title.startswith("Weekly Review"):
                new_start, new_end = block_end, block_end
            else:
                new_start, new_end = block_start, block_end
            if task.start_date != new_start or task.deadline != new_end:
                task.start_date = new_start
                task.deadline = new_end
                tasks_updated += 1

        cursor = block_end + timedelta(days=1)

    db.commit()
    return RegenerateResult(reviews_updated, days_moved, tasks_updated)
