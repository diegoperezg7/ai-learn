"""SQLAlchemy models for AI Mastery Hub."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


task_skills = Table(
    "task_skills",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)

resource_skills = Table(
    "resource_skills",
    Base.metadata,
    Column("resource_id", ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)

task_resources = Table(
    "task_resources",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("resource_id", ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True),
)


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    category = Column(String(40), nullable=False)  # AI Engineering | Software Engineering | Cloud / Infra | Models / ML
    priority = Column(String(20), nullable=False, default="Medium")  # Critical | High | Medium | Optional
    description = Column(Text, default="")
    why_it_matters = Column(Text, default="")
    completion_criteria = Column(Text, default="")
    practice_evidence = Column(Text, default="")
    current_level = Column(Integer, default=0)  # 0-5
    target_level = Column(Integer, default=5)
    status = Column(String(30), default="Not Started")
    icon = Column(String(60), default="")  # logo key, see frontend/src/lib/logos
    color = Column(String(20), default="#22d3ee")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    tasks: Mapped[list["Task"]] = relationship(secondary=task_skills, back_populates="skills")
    resources: Mapped[list["Resource"]] = relationship(secondary=resource_skills, back_populates="skills")
    questions: Mapped[list["InterviewQuestion"]] = relationship(back_populates="skill")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    provider = Column(String(80), default="")
    kind = Column(String(40), default="Course")  # Course | Practice Track | Docs | Reference | Video Series | Book
    url = Column(String(500), default="")
    price = Column(String(40), default="Free")  # Free | Free audit / paid cert | Paid
    free_access = Column(Boolean, default=True)
    estimated_hours = Column(Float, default=0)
    priority = Column(String(20), default="Medium")
    status = Column(String(20), default="Backlog")  # Backlog | In Progress | Done | Dropped
    rating = Column(Float, nullable=True)
    verdict = Column(Text, default="")
    notes = Column(Text, default="")
    icon = Column(String(60), default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    skills: Mapped[list[Skill]] = relationship(secondary=resource_skills, back_populates="resources")
    tasks: Mapped[list["Task"]] = relationship(secondary=task_resources, back_populates="resources")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    category = Column(String(40), default="AI Engineering")
    phase = Column(String(40), default="Sprint 12w")  # Sprint 12w | Break | Consolidation | Models & Advanced AI | Optional / Filler
    week = Column(Integer, nullable=True)
    start_date = Column(Date, nullable=True)
    deadline = Column(Date, nullable=True)
    priority = Column(String(20), default="Medium")
    estimated_hours = Column(Float, default=0)
    status = Column(String(30), default="Not Started")
    mode = Column(String(20), default="Practice")  # Practice | Theory | Mixed
    deliverable = Column(Text, default="")
    interview_relevant = Column(Boolean, default=False)
    today_focus = Column(Boolean, default=False)
    notes = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    skills: Mapped[list[Skill]] = relationship(secondary=task_skills, back_populates="tasks")
    resources: Mapped[list[Resource]] = relationship(secondary=task_resources, back_populates="tasks")
    checklist: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="ChecklistItem.sort_order"
    )
    sessions: Mapped[list["StudySession"]] = relationship(back_populates="task")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    text = Column(String(400), nullable=False)
    done = Column(Boolean, default=False)
    started = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0)

    task: Mapped[Task] = relationship(back_populates="checklist")


class StudySession(Base):
    """One logged block of study time. This is the single source of truth for hours."""

    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True)
    day = Column(Date, nullable=False, index=True)
    minutes = Column(Integer, nullable=False, default=0)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    mode = Column(String(20), default="Practice")
    used_ai = Column(Boolean, default=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    task: Mapped[Task | None] = relationship(back_populates="sessions")


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"

    id = Column(Integer, primary_key=True)
    label = Column(String(120), nullable=False)
    week_number = Column(Integer, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    phase = Column(String(40), default="Sprint 12w")
    target_hours = Column(Float, default=6)
    exercism_done = Column(Integer, default=0)
    interview_qs_passed = Column(Integer, default=0)
    built = Column(Text, default="")
    learned = Column(Text, default="")
    cannot_explain_yet = Column(Text, default="")
    without_ai = Column(Text, default="")
    with_ai = Column(Text, default="")
    blockers = Column(Text, default="")
    biggest_weakness = Column(Text, default="")
    biggest_improvement = Column(Text, default="")
    next_week_goal = Column(Text, default="")
    done = Column(Boolean, default=False)


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False)
    area = Column(String(60), default="")
    difficulty = Column(String(20), default="Mid")
    can_explain = Column(Boolean, default=False)
    can_implement = Column(Boolean, default=False)
    last_reviewed = Column(Date, nullable=True)
    # Spaced repetition: a question you got right comes back later, one you failed comes back tomorrow.
    next_review = Column(Date, nullable=True)
    interval_days = Column(Integer, default=0)
    notes = Column(Text, default="")
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="SET NULL"), nullable=True)

    skill: Mapped[Skill | None] = relationship(back_populates="questions")

    @property
    def readiness(self) -> str:
        if self.can_explain and self.can_implement:
            return "Interview Ready"
        if self.can_explain:
            return "Can Explain Only"
        if self.can_implement:
            return "Can Code Only"
        return "Not Ready"


class DayPlan(Base):
    """One concrete study session on one day. This is what "what do I do today" reads.

    Scope is deliberately bounded: a named exercise, a numbered lesson, a section of
    docs. Deliberate practice needs a target you can finish and verify, not "estudiar RAG".
    """

    __tablename__ = "day_plans"

    id = Column(Integer, primary_key=True)
    day = Column(Date, nullable=False, index=True)
    week = Column(Integer, nullable=True)
    slot = Column(Integer, default=0)  # order within the day
    title = Column(String(250), nullable=False)
    scope = Column(Text, default="")   # exactly what to do and where to stop
    minutes = Column(Integer, default=45)
    mode = Column(String(20), default="Practice")
    done = Column(Boolean, default=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)

    task: Mapped["Task | None"] = relationship()
    resource: Mapped["Resource | None"] = relationship()


class CVDocument(Base):
    """Singleton row holding the living CV in markdown."""

    __tablename__ = "cv_document"

    id = Column(Integer, primary_key=True)
    content = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CVSuggestion(Base):
    """A CV bullet proposed when evidence appears (skill mastered, deliverable shipped)."""

    __tablename__ = "cv_suggestions"

    id = Column(Integer, primary_key=True)
    section = Column(String(60), default="Technical Skills")
    content = Column(Text, nullable=False)
    rationale = Column(Text, default="")
    source_skill_id = Column(Integer, ForeignKey("skills.id", ondelete="SET NULL"), nullable=True)
    source_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="suggested")  # suggested | accepted | rejected
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    key = Column(String(160), unique=True, index=True)  # dedupe key
    level = Column(String(20), default="info")  # info | success | warning | danger
    title = Column(String(200), nullable=False)
    body = Column(Text, default="")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(80), primary_key=True)
    value = Column(Text, default="")
