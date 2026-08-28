import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api } from '../lib/api'
import type {
  AppNotification, CVSuggestion, Dashboard, DayPlan, Question, Resource, Skill, StudySession, Task, WeeklyReview,
} from '../lib/api'
import { translate } from '../i18n'
import type { Lang, TKey } from '../i18n'

type Theme = 'light' | 'dark'
export interface Toast { id: number; message: string; kind: 'info' | 'success' | 'danger' }

interface Prefs {
  theme: Theme
  lang: Lang
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setLang: (l: Lang) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      lang: 'es',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'hub-prefs' },
  ),
)

/** Translation hook bound to the persisted language. */
export function useT() {
  const lang = usePrefs((s) => s.lang)
  return (key: TKey) => translate(lang, key)
}

interface DataState {
  loaded: boolean
  loading: boolean
  error: string | null
  dashboard: Dashboard | null
  tasks: Task[]
  skills: Skill[]
  resources: Resource[]
  questions: Question[]
  reviews: WeeklyReview[]
  sessions: StudySession[]
  notifications: AppNotification[]
  suggestions: CVSuggestion[]
  days: DayPlan[]
  toasts: Toast[]

  loadAll: () => Promise<void>
  refreshDashboard: () => Promise<void>
  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void

  completeDayPlan: (plan: DayPlan) => Promise<void>
  startDayPlan: (plan: DayPlan) => Promise<void>
  toggleActivity: (plan: DayPlan, activityId: number, done: boolean) => Promise<void>
  setTaskStatus: (id: number, status: string) => Promise<void>
  toggleFocus: (task: Task) => Promise<void>
  toggleChecklist: (taskId: number, itemId: number, done: boolean) => Promise<void>
  logSession: (body: { minutes: number; task_id?: number | null; mode?: string; used_ai?: boolean; notes?: string }) => Promise<void>
  patchSkill: (id: number, body: Partial<Skill>) => Promise<void>
  patchResource: (id: number, body: Partial<Resource>) => Promise<void>
  patchQuestion: (id: number, body: Partial<Question>) => Promise<void>
  patchReview: (id: number, body: Partial<WeeklyReview>) => Promise<void>
  loadSuggestions: () => Promise<void>
  acceptSuggestion: (id: number) => Promise<void>
  rejectSuggestion: (id: number) => Promise<void>
  markNotificationRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

let toastSeq = 0

export const useData = create<DataState>()((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  dashboard: null,
  tasks: [],
  skills: [],
  resources: [],
  questions: [],
  reviews: [],
  sessions: [],
  notifications: [],
  suggestions: [],
  days: [],
  toasts: [],

  toast: (message, kind = 'info') => {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, message, kind }] })
    setTimeout(() => get().dismissToast(id), 4200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      await api.refreshNotifications().catch(() => undefined)
      const [dashboard, tasks, skills, resources, questions, reviews, sessions, notifications, days] = await Promise.all([
        api.dashboard(), api.tasks(), api.skills(), api.resources(),
        api.questions(), api.reviews(), api.sessions(), api.notifications(), api.days(),
      ])
      set({ dashboard, tasks, skills, resources, questions, reviews, sessions, notifications, days, loaded: true })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Error de carga' })
    } finally {
      set({ loading: false })
    }
  },

  refreshDashboard: async () => {
    try {
      const [dashboard, notifications] = await Promise.all([api.dashboard(), api.notifications()])
      set({ dashboard, notifications })
    } catch {
      /* keep previous snapshot */
    }
  },

  completeDayPlan: async (plan) => {
    if (plan.done) {
      const updated = await api.updateDay(plan.id, { done: false })
      set({ days: get().days.map((d) => (d.id === plan.id ? updated : d)) })
    } else {
      const updated = await api.completeDay(plan.id)
      set({ days: get().days.map((d) => (d.id === plan.id ? updated : d)) })
      get().toast(`+${plan.minutes} min · ${plan.title}`, 'success')
    }
    const [dashboard, sessions, tasks, days] = await Promise.all([api.dashboard(), api.sessions(), api.tasks(), api.days()])
    set({ dashboard, sessions, tasks, days })
  },

  startDayPlan: async (plan) => {
    const updated = await api.startDay(plan.id)
    set({ days: get().days.map((d) => (d.id === plan.id ? updated : d)) })
    get().toast(`En curso · ${plan.title}`, 'success')
    await get().refreshDashboard()
  },

  toggleActivity: async (plan, activityId, done) => {
    const updated = await api.toggleActivity(plan.id, activityId, done)
    set({ days: get().days.map((d) => (d.id === plan.id ? updated : d)) })
    const [dashboard, days] = await Promise.all([api.dashboard(), api.days()])
    set({ dashboard, days })
  },

  setTaskStatus: async (id, status) => {
    const updated = await api.updateTask(id, { status })
    set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) })
    await get().refreshDashboard()
    if (status === 'Completed') {
      await get().loadSuggestions()
      get().toast('Tarea completada', 'success')
    }
  },

  toggleFocus: async (task) => {
    const updated = await api.updateTask(task.id, { today_focus: !task.today_focus })
    set({ tasks: get().tasks.map((t) => (t.id === task.id ? updated : t)) })
    await get().refreshDashboard()
  },

  toggleChecklist: async (taskId, itemId, done) => {
    await api.toggleChecklist(itemId, done)
    set({
      tasks: get().tasks.map((t) =>
        t.id === taskId
          ? { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)) }
          : t,
      ),
    })
  },

  logSession: async (body) => {
    await api.logSession(body)
    const [tasks, sessions] = await Promise.all([api.tasks(), api.sessions()])
    set({ tasks, sessions })
    await get().refreshDashboard()
    get().toast(`+${body.minutes} min registrados`, 'success')
  },

  patchSkill: async (id, body) => {
    const updated = await api.updateSkill(id, body)
    set({ skills: get().skills.map((s) => (s.id === id ? updated : s)) })
    await Promise.all([get().refreshDashboard(), get().loadSuggestions()])
  },

  patchResource: async (id, body) => {
    const updated = await api.updateResource(id, body)
    set({ resources: get().resources.map((r) => (r.id === id ? updated : r)) })
  },

  patchQuestion: async (id, body) => {
    const updated = await api.updateQuestion(id, body)
    set({ questions: get().questions.map((q) => (q.id === id ? updated : q)) })
    await get().refreshDashboard()
  },

  patchReview: async (id, body) => {
    const updated = await api.updateReview(id, body)
    set({ reviews: get().reviews.map((r) => (r.id === id ? updated : r)) })
  },

  loadSuggestions: async () => {
    try {
      await api.syncCV()
      set({ suggestions: await api.cvSuggestions() })
    } catch {
      /* non critical */
    }
  },

  acceptSuggestion: async (id) => {
    await api.acceptSuggestion(id)
    set({ suggestions: get().suggestions.filter((s) => s.id !== id) })
    get().toast('Añadido al currículum', 'success')
  },

  rejectSuggestion: async (id) => {
    await api.rejectSuggestion(id)
    set({ suggestions: get().suggestions.filter((s) => s.id !== id) })
  },

  markNotificationRead: async (id) => {
    await api.readNotification(id)
    set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })
    await get().refreshDashboard()
  },

  markAllRead: async () => {
    await api.readAllNotifications()
    set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) })
    await get().refreshDashboard()
  },
}))
