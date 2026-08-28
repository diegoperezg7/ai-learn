from datetime import date
from unittest import TestCase

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import DayPlan
from app.seed import repair_seeded_plan_dates


class RepairSeededPlanDatesTest(TestCase):
    def test_restores_dates_and_slots_when_compactor_corrupted_them(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as db:
            db.add_all(
                [
                    DayPlan(
                        day=date.today(),
                        week=3,
                        slot=6,
                        title="RAG DeepLearning.AI · Módulo 2, primera mitad",
                        done=False,
                    ),
                    DayPlan(
                        day=date.today(),
                        week=4,
                        slot=11,
                        title="Richards · lecciones 161 y 159",
                        done=False,
                    ),
                    DayPlan(
                        day=date.today(),
                        week=4,
                        slot=12,
                        title="Sesión completada que no debe tocarse",
                        done=True,
                    ),
                ]
            )
            db.commit()

            repair_seeded_plan_dates(db)
            db.commit()

            rag = db.query(DayPlan).filter_by(week=3).one()
            architecture = db.query(DayPlan).filter_by(title="Richards · lecciones 161 y 159").one()
            completed = db.query(DayPlan).filter_by(done=True).one()

            self.assertEqual(rag.day, date(2026, 9, 4))
            self.assertEqual(rag.slot, 1)
            self.assertEqual(architecture.day, date(2026, 9, 11))
            self.assertEqual(architecture.slot, 1)
            self.assertEqual(completed.day, date.today())
            self.assertEqual(completed.slot, 12)
