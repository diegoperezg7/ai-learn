"""Mirror the training plan into the Obsidian vault (Diego's "Darce" second brain).

Each week of the plan is written as one Markdown note under
``03 - Recursos/Formacion/AI-Learn/`` plus an index note. The vault is a git repo
that auto-syncs, so writing the files is all that is needed.

The vault is only present on the production host and is bind-mounted into the
container at ``VAULT_PATH``. When that path is missing (local dev, tests) every
operation is a safe no-op, so nothing here can break the rest of the app.
"""

from __future__ import annotations

import os
import unicodedata
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DayPlan, StudySession, Task, WeeklyReview
from . import plan_settings

VAULT_SUBDIR = os.path.join("03 - Recursos", "Formacion", "AI-Learn")
INDEX_NAME = "AI-Learn - Registro.md"
_DONE = {"Completed", "Interview Ready"}


def _base_dir() -> str | None:
    """The vault root, from VAULT_PATH, or None when it is not mounted."""
    root = os.environ.get("VAULT_PATH", "").strip()
    if not root or not os.path.isdir(root):
        return None
    return root


def is_enabled() -> bool:
    return _base_dir() is not None


def autosync_on(db: Session) -> bool:
    return plan_settings.get(db, plan_settings.VAULT_AUTOSYNC, "true") == "true"


def _ascii(text: str) -> str:
    """Drop accents so filenames stay portable, per the vault convention."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def _fmt(d: date | None) -> str:
    return d.isoformat() if d else "—"


def _checkbox(done: bool) -> str:
    return "[x]" if done else "[ ]"


def _render_week(
    review: WeeklyReview,
    days: list[DayPlan],
    tasks: list[Task],
    sessions: list[StudySession],
) -> str:
    done_tasks = sum(1 for t in tasks if t.status in _DONE)
    done_days = sum(1 for d in days if d.done)
    planned = sum(d.minutes for d in days)
    state = "hecha" if review.done or (tasks and done_tasks == len(tasks)) else "en curso"

    skills = sorted({s.name for t in tasks for s in t.skills})

    lines: list[str] = []
    lines.append("---")
    lines.append("tipo: registro-formacion")
    lines.append(f"semana: {review.week_number}")
    lines.append(f"fase: {review.phase or ''}")
    lines.append(f"inicio: {_fmt(review.start_date)}")
    lines.append(f"fin: {_fmt(review.end_date)}")
    lines.append(f"estado: {state}")
    lines.append(f"actualizado: {date.today().isoformat()}")
    lines.append("---")
    lines.append("")
    lines.append(f"# Semana {review.week_number:02d} — {review.label}")
    lines.append("")
    lines.append(f"> [!info] [[AI Mastery Hub]] · tareas {done_tasks}/{len(tasks)} · "
                 f"sesiones {done_days}/{len(days)} · {planned} min planificados")
    lines.append("")

    if days:
        lines.append("## Sesiones")
        for d in sorted(days, key=lambda p: (p.day, p.slot)):
            lines.append(f"- {_checkbox(d.done)} **{_fmt(d.day)}** · {d.title} ({d.minutes} min)")
            if d.scope and d.scope.strip():
                lines.append(f"  - {d.scope.strip()}")
            for a in d.activities:
                lines.append(f"  - {_checkbox(a.done)} {a.title} ({a.minutes} min)")
        lines.append("")

    if tasks:
        lines.append("## Objetivos de la semana")
        for t in sorted(tasks, key=lambda x: x.sort_order):
            lines.append(f"- {_checkbox(t.status in _DONE)} {t.title}")
            if t.deliverable and t.deliverable.strip():
                lines.append(f"  - *Entregable:* {t.deliverable.strip()}")
            if t.notes and t.notes.strip():
                lines.append(f"  - {t.notes.strip()}")
        lines.append("")

    if sessions:
        lines.append("## Notas de estudio")
        for s in sorted(sessions, key=lambda x: x.day):
            note = (s.notes or "").strip()
            lines.append(f"- **{_fmt(s.day)}** ({s.minutes} min)" + (f": {note}" if note else ""))
        lines.append("")

    if skills:
        lines.append("## Skills")
        lines.append(" · ".join(f"[[{s}]]" for s in skills))
        lines.append("")

    if review.next_week_goal and review.next_week_goal.strip():
        lines.append("## Objetivo siguiente semana")
        lines.append(review.next_week_goal.strip())
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _render_index(reviews: list[WeeklyReview], tasks_by_week: dict[int, list[Task]]) -> str:
    lines: list[str] = []
    lines.append("---")
    lines.append("tipo: indice-formacion")
    lines.append(f"actualizado: {date.today().isoformat()}")
    lines.append("---")
    lines.append("")
    lines.append("# AI-Learn — Registro de formacion")
    lines.append("")
    lines.append("Espejo automatico del plan desde la app AI-Learn. Enlaza con [[AI Mastery Hub]].")
    lines.append("")
    lines.append("| Semana | Fase | Fechas | Tareas |")
    lines.append("| --- | --- | --- | --- |")
    for r in reviews:
        tks = tasks_by_week.get(r.week_number, [])
        done = sum(1 for t in tks if t.status in _DONE)
        name = f"Semana {r.week_number:02d}"
        lines.append(f"| [[{name}]] | {r.phase or ''} | {_fmt(r.start_date)} – {_fmt(r.end_date)} | {done}/{len(tks)} |")
    lines.append("")
    return "\n".join(lines) + "\n"


def _write_if_changed(path: str, content: str) -> bool:
    """Write the file only when its content actually changes. Returns True if written."""
    try:
        with open(path, encoding="utf-8") as fh:
            if fh.read() == content:
                return False
    except FileNotFoundError:
        pass
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return True


def sync_all(db: Session) -> dict:
    """Write every numbered week (and the index) into the vault. Idempotent."""
    base = _base_dir()
    if base is None:
        return {"enabled": False, "written": 0, "path": None}

    out_dir = os.path.join(base, VAULT_SUBDIR)
    os.makedirs(out_dir, exist_ok=True)

    reviews = [
        r for r in db.scalars(select(WeeklyReview)).unique().all()
        if r.week_number is not None
    ]
    reviews.sort(key=lambda r: r.week_number)

    all_days = db.scalars(select(DayPlan)).unique().all()
    days_by_week: dict[int, list[DayPlan]] = {}
    for d in all_days:
        if d.week is not None:
            days_by_week.setdefault(d.week, []).append(d)

    all_tasks = db.scalars(select(Task)).unique().all()
    tasks_by_week: dict[int, list[Task]] = {}
    for t in all_tasks:
        if t.week is not None:
            tasks_by_week.setdefault(t.week, []).append(t)

    all_sessions = db.scalars(select(StudySession)).all()
    sessions_by_day: dict[date, list[StudySession]] = {}
    for s in all_sessions:
        sessions_by_day.setdefault(s.day, []).append(s)

    written = 0
    for r in reviews:
        wk = r.week_number
        days = days_by_week.get(wk, [])
        week_days = {d.day for d in days}
        sessions = [s for day in week_days for s in sessions_by_day.get(day, [])]
        content = _render_week(r, days, tasks_by_week.get(wk, []), sessions)
        if _write_if_changed(os.path.join(out_dir, f"Semana {wk:02d}.md"), content):
            written += 1

    if _write_if_changed(os.path.join(out_dir, INDEX_NAME), _render_index(reviews, tasks_by_week)):
        written += 1

    return {"enabled": True, "written": written, "path": os.path.join(VAULT_SUBDIR)}


def autosync(db: Session) -> None:
    """Best-effort sync after a change; never raises into the caller."""
    try:
        if is_enabled() and autosync_on(db):
            sync_all(db)
    except Exception:
        # The vault is a convenience mirror; a failure here must not break tracking.
        pass
