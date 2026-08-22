"""Pydantic schemas (API contract)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- skills


class SkillRef(ORMModel):
    id: int
    slug: str
    name: str
    category: str
    icon: str = ""
    color: str = ""


class SkillBase(BaseModel):
    name: str
    category: str
    priority: str = "Medium"
    description: str = ""
    why_it_matters: str = ""
    completion_criteria: str = ""
    practice_evidence: str = ""
    current_level: int = 0
    target_level: int = 5
    status: str = "Not Started"
    icon: str = ""
    color: str = "#22d3ee"
    sort_order: int = 0


class SkillCreate(SkillBase):
    slug: str


class SkillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    priority: str | None = None
    description: str | None = None
    why_it_matters: str | None = None
    completion_criteria: str | None = None
    practice_evidence: str | None = None
    current_level: int | None = None
    target_level: int | None = None
    status: str | None = None
    icon: str | None = None
    color: str | None = None


class SkillOut(SkillBase, ORMModel):
    id: int
    slug: str
    tasks_total: int = 0
    tasks_done: int = 0
    questions_total: int = 0
    questions_ready: int = 0
    hours_logged: float = 0


# ---------------------------------------------------------------- resources


class ResourceRef(ORMModel):
    id: int
    name: str
    url: str = ""
    icon: str = ""
    provider: str = ""


class ResourceBase(BaseModel):
    name: str
    provider: str = ""
    kind: str = "Course"
    url: str = ""
    price: str = "Free"
    free_access: bool = True
    estimated_hours: float = 0
    priority: str = "Medium"
    status: str = "Backlog"
    rating: float | None = None
    verdict: str = ""
    notes: str = ""
    icon: str = ""


class ResourceCreate(ResourceBase):
    skill_ids: list[int] = Field(default_factory=list)


class ResourceUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    priority: str | None = None
    notes: str | None = None
    rating: float | None = None
    estimated_hours: float | None = None


class ResourceOut(ResourceBase, ORMModel):
    id: int
    skills: list[SkillRef] = Field(default_factory=list)


# ---------------------------------------------------------------- checklist


class ChecklistItemIn(BaseModel):
    text: str
    done: bool = False
    sort_order: int = 0


class ChecklistItemOut(ORMModel):
    id: int
    text: str
    done: bool
    started: bool = False
    sort_order: int


# ---------------------------------------------------------------- tasks


class TaskBase(BaseModel):
    title: str
    description: str = ""
    category: str = "AI Engineering"
    phase: str = "Sprint 12w"
    week: int | None = None
    start_date: date | None = None
    deadline: date | None = None
    priority: str = "Medium"
    estimated_hours: float = 0
    status: str = "Not Started"
    mode: str = "Practice"
    deliverable: str = ""
    interview_relevant: bool = False
    today_focus: bool = False
    notes: str = ""
    sort_order: int = 0


class TaskCreate(TaskBase):
    skill_ids: list[int] = Field(default_factory=list)
    resource_ids: list[int] = Field(default_factory=list)
    checklist: list[ChecklistItemIn] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    today_focus: bool | None = None
    notes: str | None = None
    deliverable: str | None = None
    start_date: date | None = None
    deadline: date | None = None
    estimated_hours: float | None = None
    mode: str | None = None
    skill_ids: list[int] | None = None
    resource_ids: list[int] | None = None


class TaskOut(TaskBase, ORMModel):
    id: int
    completed_at: datetime | None = None
    skills: list[SkillRef] = Field(default_factory=list)
    resources: list[ResourceRef] = Field(default_factory=list)
    checklist: list[ChecklistItemOut] = Field(default_factory=list)
    actual_hours: float = 0
    window: str = "Unscheduled"


# ---------------------------------------------------------------- day plan


class DayPlanActivityOut(ORMModel):
    id: int
    title: str
    minutes: int
    url: str = ""
    done: bool


class DayPlanOut(ORMModel):
    id: int
    day: date
    week: int | None
    slot: int
    title: str
    scope: str
    minutes: int
    mode: str
    done: bool
    task_id: int | None
    resource: ResourceRef | None = None
    activities: list[DayPlanActivityOut] = Field(default_factory=list)


class DayPlanUpdate(BaseModel):
    done: bool | None = None
    started: bool | None = None
    scope: str | None = None
    minutes: int | None = None


# ---------------------------------------------------------------- sessions


class SessionCreate(BaseModel):
    day: date | None = None
    minutes: int
    task_id: int | None = None
    mode: str = "Practice"
    used_ai: bool = False
    notes: str = ""


class SessionOut(ORMModel):
    id: int
    day: date
    minutes: int
    task_id: int | None
    mode: str
    used_ai: bool
    notes: str
    task_title: str | None = None


# ---------------------------------------------------------------- reviews


class WeeklyReviewUpdate(BaseModel):
    exercism_done: int | None = None
    interview_qs_passed: int | None = None
    built: str | None = None
    learned: str | None = None
    cannot_explain_yet: str | None = None
    without_ai: str | None = None
    with_ai: str | None = None
    blockers: str | None = None
    biggest_weakness: str | None = None
    biggest_improvement: str | None = None
    next_week_goal: str | None = None
    done: bool | None = None


class WeeklyReviewOut(ORMModel):
    id: int
    label: str
    week_number: int | None
    start_date: date | None
    end_date: date | None
    phase: str
    target_hours: float
    exercism_done: int
    interview_qs_passed: int
    built: str
    learned: str
    cannot_explain_yet: str
    without_ai: str
    with_ai: str
    blockers: str
    biggest_weakness: str
    biggest_improvement: str
    next_week_goal: str
    done: bool
    actual_hours: float = 0
    adherence: float = 0
    is_current: bool = False


# ---------------------------------------------------------------- interview


class QuestionUpdate(BaseModel):
    can_explain: bool | None = None
    can_implement: bool | None = None
    notes: str | None = None


class QuestionOut(ORMModel):
    id: int
    question: str
    area: str
    difficulty: str
    can_explain: bool
    can_implement: bool
    last_reviewed: date | None
    next_review: date | None = None
    interval_days: int = 0
    notes: str
    skill_id: int | None
    readiness: str = "Not Ready"
    due: bool = False


# ---------------------------------------------------------------- cv


class CVDocumentOut(ORMModel):
    content: str
    updated_at: datetime | None = None


class CVDocumentUpdate(BaseModel):
    content: str


class CVSuggestionOut(ORMModel):
    id: int
    section: str
    content: str
    rationale: str
    status: str
    source_skill_id: int | None
    source_task_id: int | None
    created_at: datetime


# ---------------------------------------------------------------- notifications


class NotificationOut(ORMModel):
    id: int
    level: str
    title: str
    body: str
    read: bool
    created_at: datetime


# ---------------------------------------------------------------- dashboard


class CategoryStat(BaseModel):
    category: str
    planned_hours: float
    logged_hours: float
    share: float


class WeekHours(BaseModel):
    week: int
    label: str
    target: float
    actual: float


class DashboardOut(BaseModel):
    today: date
    sprint_start: date
    core_deadline: date
    final_deadline: date
    days_to_core: int
    plan_days_remaining: int
    estimated_completion_date: date | None = None
    current_week: int | None
    current_week_label: str
    phase: str
    tasks_total: int
    tasks_done: int
    completion: float
    week_tasks_total: int
    week_tasks_done: int
    hours_this_week: float
    weekly_target: float
    hours_total: float
    pace_status: str  # ahead | on-track | behind | not-started
    pace_delta_hours: float
    streak_days: int
    interview_ready: int
    interview_total: int
    skills_by_status: dict[str, int]
    category_stats: list[CategoryStat]
    week_hours: list[WeekHours]
    next_milestone: str
    unread_notifications: int
    today_plan: list[DayPlanOut] = Field(default_factory=list)
    today_extra_minutes: int = 0
    today_extra_titles: list[str] = Field(default_factory=list)
    today_minutes_done: int = 0
    today_minutes_planned: int = 0
    questions_due: int = 0
