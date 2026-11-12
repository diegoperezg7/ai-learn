from datetime import date, timedelta
from unittest import TestCase

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import DayPlan, Task, WeeklyReview
from app.services import plan_settings, scheduler


def _memory_db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class BlockDaysTest(TestCase):
    def test_working_days_come_before_rest_days(self) -> None:
        # Week starting Monday 2026-11-16, Sunday (weekday 6) as rest.
        start = date(2026, 11, 16)
        days = scheduler._block_days(start, 7, {6})
        self.assertEqual(days[-1], date(2026, 11, 22))  # Sunday pushed to the end
        self.assertEqual(days[0], start)
        self.assertEqual(len(days), 7)


class RegenerateFromTodayTest(TestCase):
    def test_recompacts_pending_and_freezes_done_and_skips_rest_day(self) -> None:
        db = _memory_db()
        today = date.today()
        # Settings: start today, 6h/week, rest on every weekday except the next few so
        # the test is deterministic regardless of which weekday "today" is.
        plan_settings.put_many(
            db,
            {
                plan_settings.START_DATE: today.isoformat(),
                plan_settings.WEEKLY_HOURS: "6",
                plan_settings.REST_WEEKDAYS: "",
            },
        )
        week = WeeklyReview(
            label="S1", week_number=1, phase="Sprint 12w", sort_order=0,
            start_date=today - timedelta(days=30), end_date=today - timedelta(days=24),
        )
        db.add(week)
        done = DayPlan(day=today - timedelta(days=28), week=1, slot=0, title="hecha", done=True)
        p1 = DayPlan(day=today - timedelta(days=27), week=1, slot=1, title="pendiente 1", done=False)
        p2 = DayPlan(day=today - timedelta(days=26), week=1, slot=2, title="pendiente 2", done=False)
        task = Task(title="Tarea", week=1, status="Not Started")
        db.add_all([done, p1, p2, task])
        db.commit()

        result = scheduler.regenerate(db, "from_today")

        self.assertGreaterEqual(result.days_moved, 2)
        # Done session is frozen in the past.
        self.assertEqual(done.day, today - timedelta(days=28))
        # Pending sessions moved to today onward, in slot order.
        self.assertEqual(p1.day, today)
        self.assertEqual(p2.day, today + timedelta(days=1))
        # The week's task is re-windowed to the new block and never before today.
        self.assertEqual(task.start_date, today)
        self.assertTrue(task.deadline >= today)

    def test_rest_weekday_is_never_scheduled(self) -> None:
        db = _memory_db()
        # Anchor start on a known Monday so weekday math is deterministic.
        monday = date(2026, 11, 16)
        plan_settings.put_many(
            db,
            {
                plan_settings.START_DATE: monday.isoformat(),
                plan_settings.WEEKLY_HOURS: "6",
                plan_settings.REST_WEEKDAYS: "6",  # Sundays off
            },
        )
        week = WeeklyReview(label="S1", week_number=1, phase="Sprint 12w", sort_order=0)
        db.add(week)
        for slot in range(6):
            db.add(DayPlan(day=monday, week=1, slot=slot, title=f"s{slot}", done=False))
        db.commit()

        scheduler.regenerate(db, "full")

        scheduled = {p.day for p in db.query(DayPlan).all()}
        self.assertFalse(any(d.weekday() == 6 for d in scheduled))
