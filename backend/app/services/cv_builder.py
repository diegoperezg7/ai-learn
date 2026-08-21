"""Keeps the CV alive: turns real evidence into proposed CV bullets.

A suggestion is only created when there is evidence, never on a status guess:
  - a skill reaches Interview Ready or level >= 4
  - a task with a deliverable is completed
Suggestions must be accepted by hand before they touch the CV document.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CVDocument, CVSuggestion, Skill, Task

SECTION_FOR_CATEGORY = {
    "AI Engineering": "Technical Skills",
    "Software Engineering": "Technical Skills",
    "Cloud / Infra": "Technical Skills",
    "Models / ML": "Technical Skills",
}


def get_document(db: Session) -> CVDocument:
    doc = db.scalar(select(CVDocument).limit(1))
    if doc is None:
        doc = CVDocument(content="# CV\n")
        db.add(doc)
        db.commit()
        db.refresh(doc)
    return doc


def _exists(db: Session, *, skill_id: int | None = None, task_id: int | None = None) -> bool:
    stmt = select(CVSuggestion.id)
    if skill_id is not None:
        stmt = stmt.where(CVSuggestion.source_skill_id == skill_id)
    if task_id is not None:
        stmt = stmt.where(CVSuggestion.source_task_id == task_id)
    return db.scalar(stmt.limit(1)) is not None


def suggest_for_skill(db: Session, skill: Skill) -> CVSuggestion | None:
    """Called after a skill update. Returns a new suggestion, or None."""
    qualifies = skill.status == "Interview Ready" or skill.current_level >= 4
    if not qualifies or _exists(db, skill_id=skill.id):
        return None

    evidence = (skill.practice_evidence or "").strip()
    detail = f" — {evidence}" if evidence else ""
    suggestion = CVSuggestion(
        section=SECTION_FOR_CATEGORY.get(skill.category, "Technical Skills"),
        content=f"{skill.name}{detail}",
        rationale=(
            f"Nivel {skill.current_level}/{skill.target_level} y estado '{skill.status}'. "
            f"Criterio de completion: {skill.completion_criteria or 'sin definir'}"
        ),
        source_skill_id=skill.id,
    )
    db.add(suggestion)
    return suggestion


def suggest_for_task(db: Session, task: Task) -> CVSuggestion | None:
    """Called when a task is completed and left a real deliverable."""
    if task.status != "Completed":
        return None
    deliverable = (task.deliverable or "").strip()
    if len(deliverable) < 25 or _exists(db, task_id=task.id):
        return None

    stack = ", ".join(s.name for s in task.skills) or task.category
    suggestion = CVSuggestion(
        section="Projects",
        content=f"{task.title} — {deliverable}",
        rationale=f"Tarea completada el {task.completed_at:%Y-%m-%d} · Stack: {stack}"
        if task.completed_at
        else f"Tarea completada · Stack: {stack}",
        source_task_id=task.id,
    )
    db.add(suggestion)
    return suggestion


def apply_suggestion(db: Session, suggestion: CVSuggestion) -> CVDocument:
    """Append an accepted bullet under its markdown section, creating it if needed."""
    doc = get_document(db)
    bullet = f"- {suggestion.content.strip()}"
    lines = doc.content.splitlines()
    heading_re = re.compile(rf"^#{{1,3}}\s+{re.escape(suggestion.section)}\s*$", re.IGNORECASE)

    insert_at = None
    for idx, line in enumerate(lines):
        if heading_re.match(line.strip()):
            # walk to the end of this section
            cursor = idx + 1
            while cursor < len(lines) and not lines[cursor].lstrip().startswith("#"):
                cursor += 1
            # back off trailing blanks and separators
            while cursor - 1 > idx and lines[cursor - 1].strip() in {"", "---"}:
                cursor -= 1
            insert_at = cursor
            break

    if insert_at is None:
        if lines and lines[-1].strip():
            lines.append("")
        lines += [f"## {suggestion.section}", "", bullet, ""]
    else:
        lines.insert(insert_at, bullet)

    doc.content = "\n".join(lines).rstrip() + "\n"
    suggestion.status = "accepted"
    db.commit()
    db.refresh(doc)
    return doc


def sync_all(db: Session) -> int:
    """Sweep every skill and task and create any missing suggestions."""
    created = 0
    for skill in db.scalars(select(Skill)).unique().all():
        if suggest_for_skill(db, skill) is not None:
            created += 1
    for task in db.scalars(select(Task).where(Task.status == "Completed")).unique().all():
        if suggest_for_task(db, task) is not None:
            created += 1
    if created:
        db.commit()
    return created
