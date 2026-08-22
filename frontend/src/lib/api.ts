/** Typed client for the Hub API. */

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* keep statusText */
    }
    throw new Error(detail)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

const get = <T,>(p: string) => request<T>(p)
const post = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const patch = <T,>(p: string, body: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body) })
const put = <T,>(p: string, body: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) })
const del = (p: string) => request<void>(p, { method: 'DELETE' })

// ------------------------------------------------------------------ types

export interface SkillRef { id: number; slug: string; name: string; category: string; icon: string; color: string }

export interface Skill extends SkillRef {
  priority: string
  description: string
  why_it_matters: string
  completion_criteria: string
  practice_evidence: string
  current_level: number
  target_level: number
  status: string
  sort_order: number
  tasks_total: number
  tasks_done: number
  questions_total: number
  questions_ready: number
  hours_logged: number
}

export interface ResourceRef { id: number; name: string; url: string; icon: string; provider: string }

export interface Resource extends ResourceRef {
  kind: string
  price: string
  free_access: boolean
  estimated_hours: number
  priority: string
  status: string
  rating: number | null
  verdict: string
  notes: string
  skills: SkillRef[]
}

export interface ChecklistItem { id: number; text: string; done: boolean; sort_order: number }

export interface Task {
  id: number
  title: string
  description: string
  category: string
  phase: string
  week: number | null
  start_date: string | null
  deadline: string | null
  priority: string
  estimated_hours: number
  status: string
  mode: string
  deliverable: string
  interview_relevant: boolean
  today_focus: boolean
  notes: string
  sort_order: number
  completed_at: string | null
  skills: SkillRef[]
  resources: ResourceRef[]
  checklist: ChecklistItem[]
  actual_hours: number
  window: string
}

export interface DayPlan {
  id: number
  day: string
  week: number | null
  slot: number
  title: string
  scope: string
  minutes: number
  mode: string
  done: boolean
  started: boolean
  task_id: number | null
  resource: ResourceRef | null
  activities: { id: number; title: string; minutes: number; url: string; done: boolean }[]
}

export interface StudySession {
  id: number
  day: string
  minutes: number
  task_id: number | null
  mode: string
  used_ai: boolean
  notes: string
  task_title: string | null
}

export interface WeeklyReview {
  id: number
  label: string
  week_number: number | null
  start_date: string | null
  end_date: string | null
  phase: string
  target_hours: number
  exercism_done: number
  interview_qs_passed: number
  built: string
  learned: string
  cannot_explain_yet: string
  without_ai: string
  with_ai: string
  blockers: string
  biggest_weakness: string
  biggest_improvement: string
  next_week_goal: string
  done: boolean
  actual_hours: number
  adherence: number
  is_current: boolean
}

export interface Question {
  id: number
  question: string
  area: string
  difficulty: string
  can_explain: boolean
  can_implement: boolean
  last_reviewed: string | null
  next_review: string | null
  interval_days: number
  notes: string
  skill_id: number | null
  readiness: string
  due: boolean
}

export interface CVDoc { content: string; updated_at: string | null }

export interface CVSuggestion {
  id: number
  section: string
  content: string
  rationale: string
  status: string
  source_skill_id: number | null
  source_task_id: number | null
  created_at: string
}

export interface AppNotification {
  id: number
  level: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface CategoryStat { category: string; planned_hours: number; logged_hours: number; share: number }
export interface WeekHours { week: number; label: string; target: number; actual: number }

export interface Dashboard {
  today: string
  sprint_start: string
  core_deadline: string
  final_deadline: string
  days_to_core: number
  plan_days_remaining: number
  estimated_completion_date: string | null
  today_extra_minutes: number
  today_extra_titles: string[]
  current_week: number | null
  current_week_label: string
  phase: string
  tasks_total: number
  tasks_done: number
  completion: number
  week_tasks_total: number
  week_tasks_done: number
  hours_this_week: number
  weekly_target: number
  hours_total: number
  pace_status: string
  pace_delta_hours: number
  streak_days: number
  interview_ready: number
  interview_total: number
  skills_by_status: Record<string, number>
  category_stats: CategoryStat[]
  week_hours: WeekHours[]
  next_milestone: string
  unread_notifications: number
  today_plan: DayPlan[]
  today_minutes_done: number
  today_minutes_planned: number
  questions_due: number
}

export interface CoachHealth {
  available: boolean
  url: string
  model: string
  model_present?: boolean
  models?: string[]
  error?: string
}

// ------------------------------------------------------------------ endpoints

export const api = {
  dashboard: () => get<Dashboard>('/dashboard'),
  config: () => get<Record<string, unknown>>('/config'),
  me: () => get<{ name: string; email: string; role: string }>('/auth/me'),

  skills: () => get<Skill[]>('/skills'),
  updateSkill: (id: number, body: Partial<Skill>) => patch<Skill>(`/skills/${id}`, body),

  resources: () => get<Resource[]>('/resources'),
  updateResource: (id: number, body: Partial<Resource>) => patch<Resource>(`/resources/${id}`, body),

  tasks: (q: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()
    return get<Task[]>(`/tasks${qs ? `?${qs}` : ''}`)
  },
  updateTask: (id: number, body: Record<string, unknown>) => patch<Task>(`/tasks/${id}`, body),
  clearFocus: () => post<void>('/tasks/clear-focus'),
  toggleChecklist: (id: number, done: boolean) => patch<ChecklistItem>(`/checklist/${id}?done=${done}`, {}),

  days: (q: { day?: string; week?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()
    return get<DayPlan[]>(`/days${qs ? `?${qs}` : ''}`)
  },
  updateDay: (id: number, body: { done?: boolean; scope?: string; minutes?: number }) =>
    patch<DayPlan>(`/days/${id}`, body),
  startDay: (id: number) => post<DayPlan>(`/days/${id}/start`),
  toggleActivity: (planId: number, activityId: number, done: boolean) => patch<DayPlan>(`/days/${planId}/activities/${activityId}?done=${done}`, {}),
  completeDay: (id: number, minutes?: number) =>
    post<DayPlan>(`/days/${id}/complete${minutes ? `?minutes=${minutes}` : ''}`),

  sessions: (limit = 60) => get<StudySession[]>(`/sessions?limit=${limit}`),
  logSession: (body: { minutes: number; task_id?: number | null; mode?: string; used_ai?: boolean; notes?: string; day?: string }) =>
    post<StudySession>('/sessions', body),
  deleteSession: (id: number) => del(`/sessions/${id}`),
  heatmap: (days = 120) => get<{ day: string; minutes: number }[]>(`/sessions/heatmap?days=${days}`),

  reviews: () => get<WeeklyReview[]>('/reviews'),
  updateReview: (id: number, body: Partial<WeeklyReview>) => patch<WeeklyReview>(`/reviews/${id}`, body),

  questions: () => get<Question[]>('/questions'),
  updateQuestion: (id: number, body: Partial<Question>) => patch<Question>(`/questions/${id}`, body),

  cv: () => get<CVDoc>('/cv'),
  saveCV: (content: string) => put<CVDoc>('/cv', { content }),
  cvSuggestions: (status = 'suggested') => get<CVSuggestion[]>(`/cv/suggestions?status=${status}`),
  syncCV: () => post<{ created: number }>('/cv/suggestions/sync'),
  acceptSuggestion: (id: number) => post<CVDoc>(`/cv/suggestions/${id}/accept`),
  rejectSuggestion: (id: number) => post<void>(`/cv/suggestions/${id}/reject`),

  notifications: () => get<AppNotification[]>('/notifications'),
  refreshNotifications: () => post<{ created: number; unread: number }>('/notifications/refresh'),
  readNotification: (id: number) => post<void>(`/notifications/${id}/read`),
  readAllNotifications: () => post<void>('/notifications/read-all'),

  coachHealth: () => get<CoachHealth>('/coach/health'),
  coachChat: (message: string, role: string, history: { role: string; content: string }[]) =>
    post<{ reply: string; role: string }>('/coach/chat', { message, role, history }),
  coachBriefing: () => post<{ reply: string }>('/coach/briefing'),
}
