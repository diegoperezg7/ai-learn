"""Local LLM coach backed by Ollama on the Mac Mini.

Three roles, all deliberately constrained by the training-mode rule:
the coach never writes the solution — it explains, questions and reviews.
"""

from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import InterviewQuestion, Skill, Task
from . import progress

TRAINING_RULE = (
    "REGLA INNEGOCIABLE: estas en MODO ENTRENAMIENTO. NUNCA escribas la solucion ni el codigo "
    "completo que se te pide. Puedes explicar conceptos, hacer preguntas socraticas, dar pistas, "
    "senalar errores y revisar codigo que Diego ya haya escrito. Si te piden que escribas la "
    "solucion, niegate y devuelve una pista en su lugar. Responde SIEMPRE en espanol, de forma "
    "concisa y directa, sin florituras."
)

ROLES = {
    "coach": (
        "Eres el coach tecnico de Diego, AI Engineer que esta cerrando carencias en Python, "
        "arquitectura, backend, system design y cloud. " + TRAINING_RULE
    ),
    "interviewer": (
        "Eres un entrevistador tecnico exigente pero justo para un puesto de AI Engineer senior. "
        "Haz UNA pregunta cada vez, espera la respuesta, y despues evalua senalando concretamente "
        "que falto. No des la respuesta modelo hasta que Diego lo pida explicitamente. "
        "Responde SIEMPRE en espanol."
    ),
    "reviewer": (
        "Eres un revisor de codigo severo. Analiza el codigo que te pasa Diego y senala bugs, "
        "acoplamiento, nombres pobres, casos borde no cubiertos y decisiones cuestionables. "
        "NO reescribas el codigo entero: senala el problema y explica por que lo es. "
        "Responde SIEMPRE en espanol."
    ),
}


class CoachUnavailable(RuntimeError):
    pass


def build_context(db: Session) -> str:
    """A compact snapshot of where Diego actually is, so the coach is not generic."""
    ref = progress.today()
    lines: list[str] = [f"Fecha de hoy: {ref.isoformat()}"]

    review = progress.current_review(db, ref)
    if review:
        lines.append(f"Semana actual: {review.label} ({review.start_date} a {review.end_date})")

    status, delta = progress.pace(db, ref)
    lines.append(f"Ritmo: {status} ({delta:+.1f} h respecto al objetivo acumulado)")
    lines.append(f"Horas totales registradas: {progress.total_hours(db)}")
    lines.append(f"Racha: {progress.streak_days(db, ref)} dias")

    current = [t for t in db.scalars(select(Task)).unique().all() if progress.task_window(t, ref) == "Now"]
    if current:
        lines.append("Tareas de esta semana:")
        for task in current[:12]:
            mark = "x" if task.status in progress.DONE_STATUSES else " "
            lines.append(f"  [{mark}] {task.title} ({task.priority}, {task.estimated_hours}h) - {task.status}")

    focus = db.scalars(select(Task).where(Task.today_focus.is_(True))).unique().all()
    if focus:
        lines.append("Foco de hoy: " + "; ".join(t.title for t in focus))

    weak = db.scalars(
        select(Skill).where(Skill.priority == "Critical", Skill.current_level < Skill.target_level)
    ).unique().all()
    if weak:
        lines.append(
            "Skills criticas por debajo del objetivo: "
            + ", ".join(f"{s.name} {s.current_level}/{s.target_level}" for s in weak[:10])
        )

    not_ready = db.scalars(
        select(InterviewQuestion).where(
            (InterviewQuestion.can_explain.is_(False)) | (InterviewQuestion.can_implement.is_(False))
        )
    ).all()
    lines.append(f"Preguntas de entrevista sin dominar: {len(not_ready)}")
    return "\n".join(lines)


async def chat(db: Session, message: str, role: str = "coach", history: list[dict] | None = None) -> str:
    if not settings.coach_enabled:
        raise CoachUnavailable("El coach esta desactivado (COACH_ENABLED=false).")

    system = ROLES.get(role, ROLES["coach"]) + "\n\nCONTEXTO REAL DEL ALUMNO:\n" + build_context(db)
    messages = [{"role": "system", "content": system}]
    for turn in (history or [])[-10:]:
        if turn.get("role") in {"user", "assistant"} and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{settings.ollama_url.rstrip('/')}/api/chat",
                json={"model": settings.ollama_model, "messages": messages, "stream": False},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise CoachUnavailable(
            f"No se pudo contactar con Ollama en {settings.ollama_url}. "
            f"Comprueba que esta levantado y que el modelo '{settings.ollama_model}' existe. ({exc})"
        ) from exc

    return (data.get("message") or {}).get("content", "").strip()


async def health() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
            response.raise_for_status()
            models = [m.get("name") for m in response.json().get("models", [])]
        return {
            "available": True,
            "url": settings.ollama_url,
            "model": settings.ollama_model,
            "model_present": settings.ollama_model in models,
            "models": models,
        }
    except httpx.HTTPError as exc:
        return {"available": False, "url": settings.ollama_url, "model": settings.ollama_model, "error": str(exc)}
