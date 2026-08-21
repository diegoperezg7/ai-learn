import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Badge, CATEGORY_COLOR, Card, Empty, fmtHours } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { useData, usePrefs, useT } from '../store/useStore'

const DAY = 86400000

/* ------------------------------------------------------------------ Timeline */

export function Timeline() {
  const t = useT()
  const { tasks, reviews } = useData()

  const bounds = useMemo(() => {
    const dated = tasks.filter((x) => x.start_date && x.deadline)
    if (!dated.length) return null
    const starts = dated.map((x) => new Date(`${x.start_date}T00:00:00`).getTime())
    const ends = dated.map((x) => new Date(`${x.deadline}T00:00:00`).getTime())
    return { min: Math.min(...starts), max: Math.max(...ends) }
  }, [tasks])

  const rows = useMemo(
    () => tasks.filter((x) => x.start_date && x.deadline).sort((a, b) => a.start_date!.localeCompare(b.start_date!)),
    [tasks],
  )

  if (!bounds) return <Empty>{t('common.empty')}</Empty>
  const span = Math.max(bounds.max - bounds.min, DAY)
  const todayPct = ((Date.now() - bounds.min) / span) * 100

  return (
    <>
      <div className="page-head">
        <h2>{t('tl.title')}</h2>
        <p>{t('tl.subtitle')}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {reviews.filter((r) => r.week_number).map((r) => (
            <Badge key={r.id} tone={r.is_current ? 'accent' : r.done ? 'success' : ''}>
              S{r.week_number} · {fmtHours(r.actual_hours)}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <div className="tl" style={{ position: 'relative' }}>
          {todayPct >= 0 && todayPct <= 100 && (
            <div
              className="tl-today"
              style={{ left: `calc(190px + 10px + ${todayPct}% * (100% - 200px) / 100%)` }}
              title={t('common.today')}
            />
          )}
          {rows.map((task) => {
            const start = new Date(`${task.start_date}T00:00:00`).getTime()
            const end = new Date(`${task.deadline}T00:00:00`).getTime()
            const left = ((start - bounds.min) / span) * 100
            const width = Math.max(((end - start + DAY) / span) * 100, 1.4)
            const color = CATEGORY_COLOR[task.category] ?? 'var(--accent)'
            return (
              <div className="tl-row" key={task.id}>
                <span className="tl-label" title={task.title}>{task.title}</span>
                <div className="tl-track">
                  <div
                    className="tl-bar"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: color,
                      opacity: task.status === 'Completed' ? 0.45 : 1,
                    }}
                    title={`${task.start_date} → ${task.deadline}`}
                  >
                    {task.week != null ? `S${task.week}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ Calendar */

export function CalendarPage() {
  const t = useT()
  const lang = usePrefs((s) => s.lang)
  const { tasks } = useData()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [picked, setPicked] = useState<string>(() => new Date().toISOString().slice(0, 10))

  const cells = useMemo(() => {
    const first = new Date(cursor)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(start.getDate() - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [cursor])

  const tasksOn = (iso: string) =>
    tasks.filter((x) => x.start_date && x.deadline && iso >= x.start_date && iso <= x.deadline && x.phase !== 'Japan break')

  const todayIso = new Date().toISOString().slice(0, 10)
  const monthName = cursor.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { month: 'long', year: 'numeric' })
  const dayNames = lang === 'es' ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const selected = tasksOn(picked)

  return (
    <>
      <div className="page-head">
        <h2>{t('cal.title')}</h2>
        <p>{t('cal.subtitle')}</p>
      </div>

      <div className="grid grid-split">
        <Card>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft size={16} />
            </button>
            <strong style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{monthName}</strong>
            <button className="btn btn-ghost btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {dayNames.map((d, i) => (
              <div key={i} className="small dim center" style={{ fontWeight: 700, paddingBottom: 4 }}>{d}</div>
            ))}
            {cells.map((d) => {
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const inMonth = d.getMonth() === cursor.getMonth()
              const dayTasks = tasksOn(iso)
              const isToday = iso === todayIso
              const isPicked = iso === picked
              return (
                <button
                  key={iso}
                  onClick={() => setPicked(iso)}
                  style={{
                    aspectRatio: '1', border: '1px solid',
                    borderColor: isPicked ? 'var(--accent)' : isToday ? 'var(--danger)' : 'var(--border)',
                    background: isPicked ? 'var(--accent-soft)' : 'var(--surface-2)',
                    borderRadius: 8, padding: 3, opacity: inMonth ? 1 : 0.35,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    color: 'var(--text)',
                  }}
                >
                  <span className="small" style={{ fontWeight: isToday ? 800 : 500 }}>{d.getDate()}</span>
                  <div className="row" style={{ gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {dayTasks.slice(0, 3).map((x) => (
                      <span key={x.id} style={{ width: 5, height: 5, borderRadius: 99, background: CATEGORY_COLOR[x.category] }} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <div className="row" style={{ marginBottom: 12, gap: 8 }}>
            <strong>{picked}</strong>
            <Badge>{selected.length} tarea(s)</Badge>
          </div>
          {selected.length === 0 ? <Empty>Día libre</Empty> : (
            <div className="col" style={{ gap: 8 }}>{selected.map((x) => <TaskCard key={x.id} task={x} showDates={false} />)}</div>
          )}
        </Card>
      </div>
    </>
  )
}
