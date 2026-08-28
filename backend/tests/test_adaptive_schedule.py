from datetime import date
from unittest import TestCase

from app.models import DayPlan
from app.routers.tracking import _adaptive_dates


def plan(plan_id: int, day: date, slot: int = 0, done: bool = False) -> DayPlan:
    return DayPlan(id=plan_id, day=day, week=2, slot=slot, title=f"Plan {plan_id}", done=done)


class AdaptiveScheduleTest(TestCase):
    def test_fills_tomorrow_and_sunday_when_next_task_is_in_future(self) -> None:
        dates = _adaptive_dates(
            [plan(1, date(2026, 8, 29)), plan(2, date(2026, 8, 31))],
            reference=date(2026, 8, 28),
            has_progress_today=False,
            break_ranges=[],
        )
        self.assertEqual(dates, {1: date(2026, 8, 29), 2: date(2026, 8, 30)})

    def test_next_task_moves_to_same_day_after_progress(self) -> None:
        dates = _adaptive_dates(
            [plan(1, date(2026, 8, 31), done=True), plan(2, date(2026, 9, 1)), plan(3, date(2026, 9, 2))],
            reference=date(2026, 8, 31),
            has_progress_today=True,
            break_ranges=[],
        )
        self.assertEqual(dates, {2: date(2026, 8, 31), 3: date(2026, 9, 1)})

    def test_break_days_are_never_scheduled(self) -> None:
        dates = _adaptive_dates(
            [plan(1, date(2026, 10, 1)), plan(2, date(2026, 10, 2))],
            reference=date(2026, 9, 30),
            has_progress_today=False,
            break_ranges=[(date(2026, 10, 1), date(2026, 10, 18))],
        )
        self.assertEqual(dates, {1: date(2026, 10, 19), 2: date(2026, 10, 20)})
