"""Skills and learning resources."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Resource, Skill
from ..schemas import (
    ResourceCreate,
    ResourceOut,
    ResourceUpdate,
    SkillCreate,
    SkillOut,
    SkillUpdate,
)
from ..services import cv_builder, progress

router = APIRouter(tags=["catalog"])


def _skill_out(skill: Skill, rollup: dict) -> SkillOut:
    data = SkillOut.model_validate(skill)
    derived_level = int(rollup.get("derived_level", skill.current_level or 0))
    data.current_level = max(skill.current_level or 0, derived_level)
    if data.current_level >= data.target_level:
        data.status = "Interview Ready"
    elif data.current_level >= 3 and data.status in {"Not Started", "Learning"}:
        data.status = "Practicing"
    elif data.current_level >= 1 and data.status == "Not Started":
        data.status = "Learning"
    data.tasks_total = int(rollup.get("tasks_total", 0))
    data.tasks_done = int(rollup.get("tasks_done", 0))
    data.questions_total = int(rollup.get("questions_total", 0))
    data.questions_ready = int(rollup.get("questions_ready", 0))
    data.hours_logged = float(rollup.get("hours_logged", 0))
    data.evidence_percent = float(rollup.get("evidence_percent", 0))
    return data


@router.get("/skills", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db)) -> list[SkillOut]:
    rollups = progress.skill_rollups(db)
    skills = db.scalars(select(Skill).order_by(Skill.sort_order, Skill.name)).unique().all()
    return [_skill_out(s, rollups.get(s.id, {})) for s in skills]


@router.get("/skills/{skill_id}", response_model=SkillOut)
def get_skill(skill_id: int, db: Session = Depends(get_db)) -> SkillOut:
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill no encontrada")
    return _skill_out(skill, progress.skill_rollups(db).get(skill.id, {}))


@router.post("/skills", response_model=SkillOut, status_code=201)
def create_skill(payload: SkillCreate, db: Session = Depends(get_db)) -> SkillOut:
    if db.scalar(select(Skill.id).where(Skill.slug == payload.slug)):
        raise HTTPException(409, "Ya existe una skill con ese slug")
    skill = Skill(**payload.model_dump())
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return _skill_out(skill, {})


@router.patch("/skills/{skill_id}", response_model=SkillOut)
def update_skill(skill_id: int, payload: SkillUpdate, db: Session = Depends(get_db)) -> SkillOut:
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill no encontrada")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(skill, field, value)

    # If the level moved and no explicit status came with it, derive one so the
    # card never shows "Not Started" next to level 4.
    if "current_level" in data and "status" not in data:
        level = skill.current_level
        if level >= skill.target_level:
            skill.status = "Interview Ready"
        elif level >= 3:
            skill.status = "Practicing"
        elif level >= 1:
            skill.status = "Learning"
        else:
            skill.status = "Not Started"

    db.commit()
    db.refresh(skill)

    # Evidence may now justify a CV bullet.
    if cv_builder.suggest_for_skill(db, skill) is not None:
        db.commit()

    return _skill_out(skill, progress.skill_rollups(db).get(skill.id, {}))


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(skill_id: int, db: Session = Depends(get_db)) -> None:
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill no encontrada")
    db.delete(skill)
    db.commit()


# ------------------------------------------------------------------ resources


@router.get("/resources", response_model=list[ResourceOut])
def list_resources(db: Session = Depends(get_db)) -> list[Resource]:
    return db.scalars(select(Resource).order_by(Resource.priority, Resource.name)).unique().all()


@router.post("/resources", response_model=ResourceOut, status_code=201)
def create_resource(payload: ResourceCreate, db: Session = Depends(get_db)) -> Resource:
    data = payload.model_dump(exclude={"skill_ids"})
    resource = Resource(**data)
    if payload.skill_ids:
        resource.skills = db.scalars(select(Skill).where(Skill.id.in_(payload.skill_ids))).unique().all()
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.patch("/resources/{resource_id}", response_model=ResourceOut)
def update_resource(resource_id: int, payload: ResourceUpdate, db: Session = Depends(get_db)) -> Resource:
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(404, "Recurso no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)
    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/resources/{resource_id}", status_code=204)
def delete_resource(resource_id: int, db: Session = Depends(get_db)) -> None:
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(404, "Recurso no encontrado")
    db.delete(resource)
    db.commit()
