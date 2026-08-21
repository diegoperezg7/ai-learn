"""Roadmap tasks and their checklists."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ChecklistItem, Resource, Skill, Task
from ..schemas import ChecklistItemIn, ChecklistItemOut, TaskCreate, TaskOut, TaskUpdate
from ..services import cv_builder, progress

router = APIRouter(tags=["roadmap"])


def _task_out(task: Task, hours: dict[int, float]) -> TaskOut:
    data = TaskOut.model_validate(task)
    data.actual_hours = hours.get(task.id, 0.0)
    data.window = progress.task_window(task)
    return data


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    window: str | None = Query(None, description="Now | Upcoming | Past | Unscheduled"),
    phase: str | None = None,
    week: int | None = None,
    status: str | None = None,
    today_focus: bool | None = None,
    skill_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    stmt = select(Task).order_by(Task.start_date.is_(None), Task.start_date, Task.sort_order, Task.id)
    if phase:
        stmt = stmt.where(Task.phase == phase)
    if week is not None:
        stmt = stmt.where(Task.week == week)
    if status:
        stmt = stmt.where(Task.status == status)
    if today_focus is not None:
        stmt = stmt.where(Task.today_focus.is_(today_focus))

    tasks = db.scalars(stmt).unique().all()
    if window:
        tasks = [t for t in tasks if progress.task_window(t) == window]
    if skill_id is not None:
        tasks = [t for t in tasks if any(s.id == skill_id for s in t.skills)]

    hours = progress.hours_by_task(db)
    return [_task_out(t, hours) for t in tasks]


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)) -> TaskOut:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Tarea no encontrada")
    return _task_out(task, progress.hours_by_task(db))


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskOut:
    task = Task(**payload.model_dump(exclude={"skill_ids", "resource_ids", "checklist"}))
    if payload.skill_ids:
        task.skills = db.scalars(select(Skill).where(Skill.id.in_(payload.skill_ids))).unique().all()
    if payload.resource_ids:
        task.resources = db.scalars(select(Resource).where(Resource.id.in_(payload.resource_ids))).unique().all()
    for idx, item in enumerate(payload.checklist):
        task.checklist.append(ChecklistItem(text=item.text, done=item.done, sort_order=item.sort_order or idx))
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_out(task, {})


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> TaskOut:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Tarea no encontrada")

    data = payload.model_dump(exclude_unset=True)
    skill_ids = data.pop("skill_ids", None)
    resource_ids = data.pop("resource_ids", None)

    previous_status = task.status
    for field, value in data.items():
        setattr(task, field, value)

    if skill_ids is not None:
        task.skills = db.scalars(select(Skill).where(Skill.id.in_(skill_ids))).unique().all()
    if resource_ids is not None:
        task.resources = db.scalars(select(Resource).where(Resource.id.in_(resource_ids))).unique().all()

    if task.status == "Completed" and previous_status != "Completed":
        task.completed_at = datetime.now(timezone.utc)
        task.today_focus = False
    elif task.status != "Completed":
        task.completed_at = None

    db.commit()
    db.refresh(task)

    if cv_builder.suggest_for_task(db, task) is not None:
        db.commit()

    return _task_out(task, progress.hours_by_task(db))


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> None:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Tarea no encontrada")
    db.delete(task)
    db.commit()


@router.post("/tasks/clear-focus", status_code=204)
def clear_focus(db: Session = Depends(get_db)) -> None:
    for task in db.scalars(select(Task).where(Task.today_focus.is_(True))).unique().all():
        task.today_focus = False
    db.commit()


# ------------------------------------------------------------------ checklist


@router.post("/tasks/{task_id}/checklist", response_model=ChecklistItemOut, status_code=201)
def add_checklist_item(task_id: int, payload: ChecklistItemIn, db: Session = Depends(get_db)) -> ChecklistItem:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Tarea no encontrada")
    item = ChecklistItem(
        task_id=task_id,
        text=payload.text,
        done=payload.done,
        sort_order=payload.sort_order or len(task.checklist),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/checklist/{item_id}", response_model=ChecklistItemOut)
def toggle_checklist_item(item_id: int, done: bool, db: Session = Depends(get_db)) -> ChecklistItem:
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(404, "Item no encontrado")
    item.done = done
    db.commit()
    db.refresh(item)
    return item


@router.delete("/checklist/{item_id}", status_code=204)
def delete_checklist_item(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(404, "Item no encontrado")
    db.delete(item)
    db.commit()
