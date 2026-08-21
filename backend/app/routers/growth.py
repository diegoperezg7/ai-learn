"""Interview readiness, the living CV, and the local LLM coach."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CVSuggestion, InterviewQuestion
from ..schemas import (
    CVDocumentOut,
    CVDocumentUpdate,
    CVSuggestionOut,
    QuestionOut,
    QuestionUpdate,
)
from ..services import coach as coach_service
from ..services import cv_builder, progress

router = APIRouter(tags=["growth"])


# ------------------------------------------------------------------ interview


def _question_out(question: InterviewQuestion) -> QuestionOut:
    data = QuestionOut.model_validate(question)
    data.readiness = question.readiness
    data.due = question.next_review is not None and question.next_review <= progress.today()
    return data


@router.get("/questions", response_model=list[QuestionOut])
def list_questions(
    area: str | None = None,
    ready: bool | None = None,
    skill_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[QuestionOut]:
    stmt = select(InterviewQuestion).order_by(InterviewQuestion.area, InterviewQuestion.id)
    if area:
        stmt = stmt.where(InterviewQuestion.area == area)
    if skill_id is not None:
        stmt = stmt.where(InterviewQuestion.skill_id == skill_id)
    questions = db.scalars(stmt).all()
    if ready is not None:
        questions = [q for q in questions if (q.can_explain and q.can_implement) is ready]
    return [_question_out(q) for q in questions]


@router.patch("/questions/{question_id}", response_model=QuestionOut)
def update_question(question_id: int, payload: QuestionUpdate, db: Session = Depends(get_db)) -> QuestionOut:
    question = db.get(InterviewQuestion, question_id)
    if not question:
        raise HTTPException(404, "Pregunta no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    today = progress.today()
    question.last_reviewed = today
    # Spaced repetition: what you know comes back later, what you failed comes back tomorrow.
    if question.can_explain and question.can_implement:
        question.interval_days = max(3, (question.interval_days or 0) * 2)
    else:
        question.interval_days = 1
    question.next_review = today + timedelta(days=question.interval_days)

    db.commit()
    db.refresh(question)
    return _question_out(question)


# ------------------------------------------------------------------ cv


@router.get("/cv", response_model=CVDocumentOut)
def get_cv(db: Session = Depends(get_db)) -> CVDocumentOut:
    return CVDocumentOut.model_validate(cv_builder.get_document(db))


@router.put("/cv", response_model=CVDocumentOut)
def update_cv(payload: CVDocumentUpdate, db: Session = Depends(get_db)) -> CVDocumentOut:
    doc = cv_builder.get_document(db)
    doc.content = payload.content
    db.commit()
    db.refresh(doc)
    return CVDocumentOut.model_validate(doc)


@router.get("/cv/suggestions", response_model=list[CVSuggestionOut])
def list_suggestions(status: str = "suggested", db: Session = Depends(get_db)) -> list[CVSuggestion]:
    stmt = select(CVSuggestion).order_by(CVSuggestion.created_at.desc())
    if status != "all":
        stmt = stmt.where(CVSuggestion.status == status)
    return db.scalars(stmt).all()


@router.post("/cv/suggestions/sync")
def sync_suggestions(db: Session = Depends(get_db)) -> dict:
    return {"created": cv_builder.sync_all(db)}


@router.post("/cv/suggestions/{suggestion_id}/accept", response_model=CVDocumentOut)
def accept_suggestion(suggestion_id: int, db: Session = Depends(get_db)) -> CVDocumentOut:
    suggestion = db.get(CVSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(404, "Sugerencia no encontrada")
    if suggestion.status == "accepted":
        raise HTTPException(409, "Esa sugerencia ya se aplico")
    return CVDocumentOut.model_validate(cv_builder.apply_suggestion(db, suggestion))


@router.post("/cv/suggestions/{suggestion_id}/reject", status_code=204)
def reject_suggestion(suggestion_id: int, db: Session = Depends(get_db)) -> None:
    suggestion = db.get(CVSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(404, "Sugerencia no encontrada")
    suggestion.status = "rejected"
    db.commit()


# ------------------------------------------------------------------ coach


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    role: str = "coach"
    history: list[ChatTurn] = []


@router.get("/coach/health")
async def coach_health() -> dict:
    return await coach_service.health()


@router.get("/coach/context")
def coach_context(db: Session = Depends(get_db)) -> dict:
    return {"context": coach_service.build_context(db)}


@router.post("/coach/chat")
async def coach_chat(payload: ChatRequest, db: Session = Depends(get_db)) -> dict:
    try:
        reply = await coach_service.chat(
            db,
            payload.message,
            role=payload.role,
            history=[t.model_dump() for t in payload.history],
        )
    except coach_service.CoachUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"reply": reply, "role": payload.role}


@router.post("/coach/briefing")
async def coach_briefing(db: Session = Depends(get_db)) -> dict:
    prompt = (
        "Dame el briefing de hoy en maximo 6 lineas: que toca, en que orden, cuanto tiempo, "
        "y una advertencia si voy retrasado. Nada de motivacion vacia."
    )
    try:
        reply = await coach_service.chat(db, prompt, role="coach")
    except coach_service.CoachUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"reply": reply}
