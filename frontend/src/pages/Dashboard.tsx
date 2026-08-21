import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Brain, CalendarDays, CheckCircle2, Coffee, Flame, TrendingUp } from 'lucide-react'

import { Badge, Card, CardHead, Empty, ProgressBar, fmtDate, fmtHours } from '../components/ui'
import { DaySession } from '../components/DaySession'
import { WeeklyHoursChart } from '../components/charts'
import { useData, usePrefs, useT } from '../store/useStore'

const PACE_TONE: Record<string, string> = {
  ahead: 'var(--success)',
  'on-track': 'var(--accent)',
  behind: 'var(--danger)',
  'not-started': 'var(--text-dim)',
}

export function Dashboard() {
  const t = useT()
  const lang = usePrefs((s) => s.lang)
  const { dashboard, days } = useData()

  const todayIso = dashboard?.today ?? ''

  /** The rest of this week, so tomorrow is never a surprise. */
  const restOfWeek = useMemo(() => {
    if (!dashboard?.current_week) return []
    return days
      .filter((d) => d.week === dashboard.current_week && d.day > todayIso)
      .sort((a, b) => a.day.localeCompare(b.day) || a.slot - b.slot)
  }, [days, dashboard, todayIso])

  const weekPlan = useMemo(
    () => days.filter((d) => d.week === dashboard?.current_week),
    [days, dashboard],
  )

  const weekChart = useMemo(
    () => (dashboard?.week_hours ?? []).map((w) => ({ label: `S${w.week}`, target: w.target, actual: w.actual })),
    [dashboard],
  )

  if (!dashboard) return <Empty>{t('common.loading')}</Empty>

  const d = dashboard
  const todayDone = d.today_plan.filter((p) => p.done).length
  const todayPct = d.today_minutes_planned ? (d.today_minutes_done / d.today_minutes_planned) * 100 : 0
  const weekDoneMin = weekPlan.filter((p) => p.done).reduce((a, p) => a + p.minutes, 0)
  const weekTotalMin = weekPlan.reduce((a, p) => a + p.minutes, 0)
  const allTodayDone = d.today_plan.length > 0 && todayDone === d.today_plan.length
  const nextOptional = restOfWeek.find((p) => !p.done)

  const rawDay = new Date(`${d.today}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  // Solo la primera letra: "Jueves, 20 de agosto", no "Jueves, 20 De Agosto".
  const dayLabel = rawDay.charAt(0).toUpperCase() + rawDay.slice(1)

  return (
    <>
      {/* ---------------------------------------------------------- HOY */}
      <div className="page-head">
        <h2>{dayLabel}</h2>
        <p>
          {d.current_week_label} · {fmtHours(weekDoneMin / 60)} de {fmtHours(weekTotalMin / 60)} esta semana
        </p>
      </div>

      <Card style={{ marginBottom: 14, borderColor: allTodayDone ? 'var(--success)' : 'var(--accent)' }}>
        <CardHead
          title={d.today_plan.length ? `Hoy · ${d.today_minutes_planned} min` : 'Hoy'}
          icon={allTodayDone ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : <Flame size={16} style={{ color: 'var(--accent)' }} />}
          right={d.today_plan.length ? <Badge tone={allTodayDone ? 'success' : 'accent'}>{todayDone}/{d.today_plan.length}</Badge> : undefined}
        />

        {d.today_plan.length === 0 ? (
          <div className="empty">
            <Coffee size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div><strong>Día libre.</strong></div>
            <div className="small" style={{ marginTop: 4 }}>
              El plan exige descansar. Si tienes ganas, adelanta algo de mañana desde el Roadmap.
            </div>
          </div>
        ) : (
          <>
            <div className="col" style={{ gap: 8 }}>
              {d.today_plan.map((p) => <DaySession key={p.id} plan={p} />)}
            </div>
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={todayPct} tone={allTodayDone ? 'var(--success)' : undefined} />
            </div>
            {allTodayDone && (
              <>
                <p className="small" style={{ color: 'var(--success)', marginBottom: 8, marginTop: 8 }}>
                  Hecho. {d.today_minutes_done} minutos registrados hoy.
                </p>
                <div className="done-next-card">
                  <div>
                    <strong>¿Quieres hacer algo más?</strong>
                    <div className="small dim" style={{ marginTop: 3 }}>
                      El objetivo de hoy está cumplido. Puedes parar aquí o revisar la próxima lección y decidir si hacerla completa o dividirla en bloques.
                    </div>
                    {nextOptional && (
                      <div className="small" style={{ marginTop: 7 }}>
                        Siguiente: <strong>{nextOptional.title}</strong> · {nextOptional.minutes} min
                      </div>
                    )}
                  </div>
                  <div className="row wrap" style={{ gap: 6, flexShrink: 0 }}>
                    <Link to="/roadmap" className="btn btn-sm btn-primary">
                      {nextOptional ? 'Revisar próxima lección' : 'Explorar roadmap'} <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      {/* ---------------------------------------------------------- KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Card>
          <div className="stat-label">Esta semana</div>
          <div className="stat-value">{fmtHours(d.hours_this_week)}</div>
          <div className="stat-sub">de {fmtHours(d.weekly_target)}</div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={d.weekly_target ? (d.hours_this_week / d.weekly_target) * 100 : 0} thin />
          </div>
        </Card>
        <Card>
          <div className="stat-label">{t('dash.pace')}</div>
          <div className="stat-value" style={{ color: PACE_TONE[d.pace_status], fontSize: 20 }}>
            {t(`dash.pace.${d.pace_status}` as never)}
          </div>
          <div className="stat-sub">
            {d.pace_status === 'not-started' ? '—' : `${d.pace_delta_hours > 0 ? '+' : ''}${d.pace_delta_hours} h`}
          </div>
        </Card>
        <Card>
          <div className="stat-label">{t('dash.streak')}</div>
          <div className="stat-value">{d.streak_days}</div>
          <div className="stat-sub">días seguidos</div>
        </Card>
        <Card>
          <div className="stat-label">Al deadline</div>
          <div className="stat-value">{d.days_to_core}</div>
          <div className="stat-sub">días · {d.completion}% del plan</div>
        </Card>
      </div>

      {/* ---------------------------------------------------------- avisos */}
      {(d.pace_status === 'behind' || d.questions_due > 0) && (
        <div className="col" style={{ gap: 8, marginBottom: 14 }}>
          {d.pace_status === 'behind' && (
            <Card style={{ borderColor: 'var(--danger)' }}>
              <div className="row" style={{ gap: 10 }}>
                <AlertTriangle size={17} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <span className="small" style={{ flex: 1 }}>
                  Vas <strong>{Math.abs(d.pace_delta_hours)} h</strong> por detrás. Recorta alcance o suma 30 min al día — no metas una jornada doble.
                </span>
              </div>
            </Card>
          )}
          {d.questions_due > 0 && (
            <Card>
              <div className="row" style={{ gap: 10 }}>
                <Brain size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="small" style={{ flex: 1 }}>
                  <strong>{d.questions_due}</strong> pregunta(s) tocan repaso hoy.
                </span>
                <Link to="/interview" className="btn btn-sm">Repasar <ArrowRight size={13} /></Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- semana + grafico */}
      <div className="grid grid-main">
      <Card>
        <CardHead
          title="Lo que queda esta semana"
          icon={<CalendarDays size={16} style={{ color: 'var(--accent)' }} />}
          right={<Link to="/roadmap" className="btn btn-sm">Ver roadmap <ArrowRight size={13} /></Link>}
        />
        {restOfWeek.length === 0 ? (
          <Empty>Semana cerrada. Buen trabajo.</Empty>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {restOfWeek.map((p) => (
              <div key={p.id} className="row upcoming" style={{ gap: 10 }}>
                <span className="badge" style={{ minWidth: 62, justifyContent: 'center' }}>{fmtDate(p.day, lang)}</span>
                <span className="small" style={{ flex: 1, minWidth: 0 }}>{p.title}</span>
                <span className="small dim">{p.minutes}m</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Horas por semana"
          icon={<TrendingUp size={16} style={{ color: 'var(--accent)' }} />}
          right={<Link to="/progress" className="btn btn-sm">Más gráficos <ArrowRight size={13} /></Link>}
        />
        <WeeklyHoursChart data={weekChart} height={190} />
      </Card>
      </div>
    </>
  )
}
