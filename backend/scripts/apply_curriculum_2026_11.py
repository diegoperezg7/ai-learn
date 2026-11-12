"""One-time, idempotent catalogue update for the November 2026 plan revision.

The seed is bootstrap-only, so it never touches an existing (live) database. This
script applies the curriculum review to a database that already has data:

  - drops the two redundant courses (Alberta architecture, Scrimba TypeScript)
  - reduces RAG to a minimal conceptual resource
  - adds the "AI + Cybersecurity" skill and the Macquarie course
  - adds the (deferred) Claude course promoted by the company

Safe to run more than once: every change is guarded by a presence check. It targets
whatever database the app is configured for (DATABASE_URL / DATABASE_SCHEMA), so run
it inside the api container, e.g.:

    docker exec hub-api python -m scripts.apply_curriculum_2026_11
"""

from __future__ import annotations

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Resource, Skill
from app.seed_data import RESOURCES, SKILLS

DROP = ["Software Architecture — University of Alberta", "Learn TypeScript (Scrimba)"]
NEW_SKILL_SLUGS = ["ai-security"]
NEW_RESOURCE_NAMES = ["AI-Powered Cybersecurity (Macquarie)", "Anthropic Academy — Claude"]
RAG_PREFIX = "Retrieval Augmented Generation"


def _spec_by(items: list[dict], key: str, value: str) -> dict | None:
    return next((s for s in items if s.get(key) == value), None)


def main() -> None:
    changed = 0
    with SessionLocal() as db:
        existing_skills = {s.slug: s for s in db.scalars(select(Skill)).unique().all()}

        # 1. New skills (needed before linking the new resources).
        for slug in NEW_SKILL_SLUGS:
            if slug in existing_skills:
                continue
            spec = _spec_by(SKILLS, "slug", slug)
            if not spec:
                continue
            order = db.scalar(select(Skill.sort_order).order_by(Skill.sort_order.desc()).limit(1)) or 0
            skill = Skill(**spec, sort_order=order + 1)
            db.add(skill)
            existing_skills[slug] = skill
            changed += 1
            print(f"+ skill: {spec['name']}")
        db.flush()

        # 2. Drop redundant courses (keep the row for the record).
        for name in DROP:
            r = db.scalar(select(Resource).where(Resource.name == name))
            if r and r.status != "Dropped":
                r.status = "Dropped"
                spec = _spec_by(RESOURCES, "name", name)
                if spec and spec.get("verdict"):
                    r.verdict = spec["verdict"]
                changed += 1
                print(f"~ dropped: {name}")

        # 3. Reduce RAG to the minimal conceptual resource.
        rag = db.scalar(select(Resource).where(Resource.name.like(f"{RAG_PREFIX}%")))
        rag_spec = _spec_by(RESOURCES, "name", rag.name) if rag else None
        if rag and rag_spec and (rag.estimated_hours != rag_spec["estimated_hours"] or rag.priority != rag_spec["priority"]):
            rag.estimated_hours = rag_spec["estimated_hours"]
            rag.priority = rag_spec["priority"]
            rag.verdict = rag_spec.get("verdict", rag.verdict)
            changed += 1
            print(f"~ reduced: {rag.name} -> {rag.estimated_hours}h ({rag.priority})")

        # 4. New resources (Macquarie cybersecurity + deferred Claude).
        for name in NEW_RESOURCE_NAMES:
            if db.scalar(select(Resource).where(Resource.name == name)):
                continue
            spec = _spec_by(RESOURCES, "name", name)
            if not spec:
                continue
            data = {k: v for k, v in spec.items() if k != "skills"}
            data.setdefault("free_access", data.get("price", "Free") != "Paid")
            resource = Resource(**data)
            resource.skills = [existing_skills[s] for s in spec.get("skills", []) if s in existing_skills]
            db.add(resource)
            changed += 1
            print(f"+ resource: {name}")

        db.commit()

    print(f"Done. {changed} change(s) applied." if changed else "Nothing to do; already up to date.")


if __name__ == "__main__":
    main()
