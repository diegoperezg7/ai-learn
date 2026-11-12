import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Plus, Search } from 'lucide-react'

import { Badge, Card, Empty, ProgressBar, fmtDate, fmtHours } from '../components/ui'
import { DaySession } from '../components/DaySession'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import type { Task } from '../lib/api'
import { useData, usePrefs, useT } from '../store/useStore'

/** Phases that collapse into the single "Extra" tab (side tracks / backlog). */
const EXTRA_PHASES = ['Optional / Filler', 'Consolidation', 'Break', 'Deferred / Personal']
/** Preferred left-to-right order for the main phase tabs; unlisted phases go last. */
const PHASE_ORDER = ['Sprint 12w', 'Professional Certifications', 'Models & Advanced AI']

const DONE = new Set(['Completed', 'Interview Ready'])

/** "jueves, 20 ago" -> "Jueves, 20 ago". Solo la primera letra, no cada palabra. */
function formatDayLabel(day: string, lang: string): string {
  const raw = new Date(`${day}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'short',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

interface Group {
  key: string
  title: string
  subtitle: string
  order: number
  tasks: Task[]
}

export function Roadmap() {
  const t = useT()
  const lang = usePrefs((s) => s.lang)
  const { tasks, reviews, days } = useData()
  const [tabState, setTab] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showGoals, setShowGoals] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)

  // Tabs are derived from the phases actually present, so content is never
  // orphaned when the plan changes. They open on the first phase with pending work.
  const tabDefs = useMemo(() => {
    const present = Array.from(new Set(tasks.map((x) => x.phase)))
    const label = (p: string) =>
      p === 'Sprint 12w' ? t('rm.tab.sprint')
        : p === 'Professional Certifications' ? t('rm.tab.certs')
          : p === 'Models & Advanced AI' ? t('rm.tab.december')
            : p
    const defs = present
      .filter((p) => !EXTRA_PHASES.includes(p))
      .sort((a, b) => {
        const ia = PHASE_ORDER.indexOf(a), ib = PHASE_ORDER.indexOf(b)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })
      .map((p) => ({ key: p, label: label(p) }))
    if (present.some((p) => EXTRA_PHASES.includes(p))) defs.push({ key: 'extra', label: t('rm.tab.extra') })
    return defs
  }, [tasks, t])

  const pendingByKey = useMemo(() => {
    const m: Record<string, number> = {}
    tasks.forEach((x) => {
      if (DONE.has(x.status)) return
      const key = EXTRA_PHASES.includes(x.phase) ? 'extra' : x.phase
      m[key] = (m[key] ?? 0) + 1
    })
    return m
  }, [tasks])

  const tab =
    (tabState && tabDefs.some((d) => d.key === tabState) ? tabState : null)
    ?? tabDefs.find((d) => (pendingByKey[d.key] ?? 0) > 0)?.key
    ?? tabDefs[0]?.key
    ?? 'Sprint 12w'

  const weekMeta = useMemo(() => {
    const map = new Map<number, { label: string; start: string; end: string; current: boolean }>()
    reviews.forEach((r) => {
      if (r.week_number != null) {
        map.set(r.week_number, {
          label: r.label,
          start: r.start_date ?? '',
          end: r.end_date ?? '',
          current: r.is_current,
        })
      }
    })
    return map
  }, [reviews])

  const groups = useMemo<Group[]>(() => {
    const needle = q.trim().toLowerCase()
    const inTab = tasks.filter((x) =>
      tab === 'extra' ? EXTRA_PHASES.includes(x.phase) : x.phase === tab,
    )

    const filtered = inTab.filter((x) => {
      if (hideDone && DONE.has(x.status)) return false
      if (needle) {
        const sessionText = days
          .filter((plan) => plan.task_id === x.id)
          .flatMap((plan) => [
            plan.title,
            plan.scope,
            plan.resource?.name ?? '',
            ...plan.activities.map((activity) => activity.title),
          ])
          .join(' ')
        const searchable = `${x.title} ${x.description} ${x.category} ${x.deliverable} ${sessionText}`.toLowerCase()
        if (!searchable.includes(needle)) return false
      }
      return true
    })

    const map = new Map<string, Group>()
    filtered.forEach((task) => {
      const week = task.week
      const key = week != null ? `w${week}` : task.phase
      if (!map.has(key)) {
        const meta = week != null ? weekMeta.get(week) : undefined
        map.set(key, {
          key,
          // "S3 — Advanced Retrieval" -> title "Semana 3", subtitle "Advanced Retrieval"
          title: week != null ? `${t('common.week')} ${week}` : task.phase,
          subtitle: meta?.label.split('—')[1]?.trim() ?? '',
          order: week ?? 900,
          tasks: [],
        })
      }
      map.get(key)!.tasks.push(task)
    })

    return [...map.values()]
      .map((g) => ({ ...g, tasks: g.tasks.sort((a, b) => a.sort_order - b.sort_order) }))
      .sort((a, b) => a.order - b.order)
  }, [tasks, days, tab, q, hideDone, weekMeta, t])

  const sprintTasks = tasks.filter((x) => x.phase === 'Sprint 12w')
  const sprintDone = sprintTasks.filter((x) => DONE.has(x.status)).length
  const today = new Date().toISOString().slice(0, 10)
  const overduePlan = useMemo(
    () => days
      .filter((plan) => plan.day < today && !plan.done && plan.task_id != null)
      .sort((a, b) => a.day.localeCompare(b.day) || a.slot - b.slot)[0] ?? null,
    [days, today],
  )

  return (
    <>
      <div className="page-head">
        <h2>{t('nav.roadmap')}</h2>
        <p>{t('rm.summary', { done: sprintDone, total: sprintTasks.length })}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <ProgressBar value={sprintTasks.length ? (sprintDone / sprintTasks.length) * 100 : 0} />
      </Card>

      {overduePlan && (
        <Card style={{ marginBottom: 14, borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}>
          <div className="row wrap between" style={{ gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div className="small" style={{ color: 'var(--danger)', fontWeight: 700 }}>{t('rm.priorityToday')}</div>
              <strong>{overduePlan.title}</strong>
              <div className="small dim" style={{ marginTop: 3 }}>
                {t('rm.plannedFor', { day: formatDayLabel(overduePlan.day, lang), min: overduePlan.minutes })}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}><DaySession plan={overduePlan} /></div>
          </div>
        </Card>
      )}

      <div className="tabs">
        {tabDefs.map((x) => (
          <button key={x.key} className={`tab ${tab === x.key ? 'active' : ''}`} onClick={() => setTab(x.key)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <div className="row" style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} style={{ paddingLeft: 32 }} />
        </div>
        <button className={`btn btn-sm ${hideDone ? 'btn-primary' : ''}`} onClick={() => setHideDone(!hideDone)}>
          <Check size={14} /> {t('rm.hideDone')}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> {t('form.newTask')}
        </button>
      </div>

      {groups.length === 0 ? (
        <Empty>{t('common.empty')}</Empty>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {groups.map((g) => {
            const meta = weekMeta.get(g.order)
            const done = g.tasks.filter((x) => DONE.has(x.status)).length
            const hours = g.tasks.reduce((a, x) => a + x.estimated_hours, 0)
            const isOpen = collapsed[g.key] !== true
            const allDone = done === g.tasks.length && g.tasks.length > 0
            const adaptiveDays = days
              .filter((plan) => plan.week === g.order && !plan.done)
              .map((plan) => plan.day)
              .sort()
            const displayStart = adaptiveDays[0] ?? meta?.start
            const displayEnd = adaptiveDays.at(-1) ?? meta?.end
            return (
              <Card
                key={g.key}
                style={meta?.current ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } : undefined}
              >
                <button
                  className="row week-head"
                  onClick={() => setCollapsed({ ...collapsed, [g.key]: isOpen })}
                  style={{ width: '100%', background: 'none', border: 'none', padding: 0, color: 'var(--text)', gap: 10 }}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{g.title}</strong>
                      {meta?.current && <Badge tone="accent">{t('rm.now')}</Badge>}
                      {allDone && <Badge tone="success">{t('rm.done')}</Badge>}
                    </div>
                    {g.subtitle && <div className="small muted" style={{ marginTop: 1 }}>{g.subtitle}</div>}
                  </div>
                  {displayStart && displayEnd && (
                    <span className="small dim week-dates">
                      {fmtDate(displayStart, lang)} – {fmtDate(displayEnd, lang)}
                    </span>
                  )}
                  <Badge>{fmtHours(hours)}</Badge>
                  <Badge tone={allDone ? 'success' : ''}>{done}/{g.tasks.length}</Badge>
                </button>

                {isOpen && (
                  <div className="col" style={{ gap: 10, marginTop: 12 }}>
                    {(() => {
                      const visibleTaskIds = new Set(g.tasks.map((task) => task.id))
                      const weekDays = days
                        .filter((p) => p.week === g.order && visibleTaskIds.has(p.task_id ?? -1) && (!hideDone || !p.done))
                        .sort((a, b) => a.day.localeCompare(b.day) || a.slot - b.slot)
                      const byDay = new Map<string, typeof weekDays>()
                      weekDays.forEach((p) => byDay.set(p.day, [...(byDay.get(p.day) ?? []), p]))

                      if (byDay.size === 0) {
                        return g.tasks.map((task) => <TaskCard key={task.id} task={task} showDates={false} />)
                      }

                      return (
                        <>
                          {[...byDay.entries()].map(([day, sessions]) => (
                            <div key={day}>
                              <div className="row day-label" style={{ gap: 8, marginBottom: 5 }}>
                                <strong className="small">{formatDayLabel(day, lang)}</strong>
                                {day === new Date().toISOString().slice(0, 10) && <Badge tone="accent">{t('common.today')}</Badge>}
                              </div>
                              <div className="col" style={{ gap: 6 }}>
                                {sessions.map((p) => <DaySession key={p.id} plan={p} />)}
                              </div>
                            </div>
                          ))}

                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ alignSelf: 'flex-start' }}
                            onClick={() => setShowGoals({ ...showGoals, [g.key]: !showGoals[g.key] })}
                          >
                            {showGoals[g.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {t('rm.weekGoals', { n: g.tasks.length })}
                          </button>
                          {showGoals[g.key] && (
                            <div className="col" style={{ gap: 8 }}>
                              {g.tasks.map((task) => <TaskCard key={task.id} task={task} showDates={false} />)}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </>
  )
}
