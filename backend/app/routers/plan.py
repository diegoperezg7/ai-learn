"""Editable plan settings and calendar regeneration."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import PlanSettingsOut, PlanSettingsUpdate, RegenerateIn, RegenerateOut
from ..services import notifier, plan_settings, scheduler

router = APIRouter(tags=["plan"])


def _out(db: Session) -> PlanSettingsOut:
    cfg = plan_settings.load(db)
    return PlanSettingsOut(
        start_date=cfg.start_date,
        core_deadline=cfg.core_deadline,
        final_deadline=cfg.final_deadline,
        weekly_target_hours=cfg.weekly_target_hours,
        rest_weekdays=sorted(cfg.rest_weekdays),
    )


@router.get("/settings", response_model=PlanSettingsOut)
def get_settings(db: Session = Depends(get_db)) -> PlanSettingsOut:
    return _out(db)


@router.put("/settings", response_model=PlanSettingsOut)
def update_settings(payload: PlanSettingsUpdate, db: Session = Depends(get_db)) -> PlanSettingsOut:
    data = payload.model_dump(exclude_unset=True)
    updates: dict[str, str] = {}

    if "start_date" in data and data["start_date"] is not None:
        updates[plan_settings.START_DATE] = data["start_date"].isoformat()
    if "core_deadline" in data and data["core_deadline"] is not None:
        updates[plan_settings.CORE_DEADLINE] = data["core_deadline"].isoformat()
    if "final_deadline" in data and data["final_deadline"] is not None:
        updates[plan_settings.FINAL_DEADLINE] = data["final_deadline"].isoformat()
    if "weekly_target_hours" in data and data["weekly_target_hours"] is not None:
        hours = float(data["weekly_target_hours"])
        if hours <= 0:
            raise HTTPException(400, "Las horas semanales deben ser mayores que cero")
        updates[plan_settings.WEEKLY_HOURS] = str(hours)
    if "rest_weekdays" in data and data["rest_weekdays"] is not None:
        days = sorted({int(d) for d in data["rest_weekdays"]})
        if any(d < 0 or d > 6 for d in days):
            raise HTTPException(400, "Los dias de descanso deben estar entre 0 (lunes) y 6 (domingo)")
        if len(days) >= 7:
            raise HTTPException(400, "No puedes marcar los 7 dias como descanso")
        updates[plan_settings.REST_WEEKDAYS] = ",".join(str(d) for d in days)

    if updates:
        plan_settings.put_many(db, updates)
    return _out(db)


@router.post("/plan/regenerate", response_model=RegenerateOut)
def regenerate_plan(payload: RegenerateIn, db: Session = Depends(get_db)) -> RegenerateOut:
    if payload.mode not in ("from_today", "full"):
        raise HTTPException(400, "mode debe ser 'from_today' o 'full'")
    result = scheduler.regenerate(db, payload.mode)
    notifier.refresh(db)
    return RegenerateOut(
        reviews_updated=result.reviews_updated,
        days_moved=result.days_moved,
        tasks_updated=result.tasks_updated,
    )
