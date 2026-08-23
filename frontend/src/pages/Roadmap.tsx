import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'

import { Badge, Card, Empty, ProgressBar, fmtDate, fmtHours } from '../components/ui'
import { DaySession } from '../components/DaySession'
import { TaskCard } from '../components/TaskCard'
import type { Task } from '../lib/api'
import { useData, usePrefs, useT } from '../store/useStore'

/** Tabs map to phases. The sprint is what matters day to day, so it opens first. */
const TABS = [
  { key: 'Sprint 12w', label: 'Sprint (S1–S12)' },
  { key: 'Models & Advanced AI', label: 'Diciembre · Models' },
  { key: 'extra', label: 'Extra' },
] as const

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
  const [tab, setTab] = useState<string>('Sprint 12w')
  const [q, setQ] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showGoals, setShowGoals] = useState<Record<string, boolean>>({})

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
    const inTab = tasks.filter((x) => {
      if (tab === 'extra') return x.phase === 'Optional / Filler' || x.phase === 'Consolidation' || x.phase === 'Break'
      return x.phase === tab
    })

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

  return (
    <>
      <div className="page-head">
        <h2>{t('nav.roadmap')}</h2>
        <p>{sprintDone} de {sprintTasks.length} tareas del sprint completadas · en orden, semana a semana.</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <ProgressBar value={sprintTasks.length ? (sprintDone / sprintTasks.length) * 100 : 0} />
      </Card>

      <div className="tabs">
        {TABS.map((x) => (
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
          <Check size={14} /> Ocultar hechas
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
                      {meta?.current && <Badge tone="accent">Ahora</Badge>}
                      {allDone && <Badge tone="success">Hecha</Badge>}
                    </div>
                    {g.subtitle && <div className="small muted" style={{ marginTop: 1 }}>{g.subtitle}</div>}
                  </div>
                  {meta?.start && (
                    <span className="small dim week-dates">
                      {fmtDate(meta.start, lang)} – {fmtDate(meta.end, lang)}
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
                                {day === new Date().toISOString().slice(0, 10) && <Badge tone="accent">Hoy</Badge>}
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
                            Objetivos de la semana ({g.tasks.length})
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
    </>
  )
}
