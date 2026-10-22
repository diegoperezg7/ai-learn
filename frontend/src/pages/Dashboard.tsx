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
  const { dashboard, days, startDayPlan, completeDayPlan } = useData()

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
  const todayActivities = d.today_plan.flatMap((p) => p.activities)
  const todayActivitiesDone = todayActivities.filter((a) => a.done).length
  const todayPct = d.today_minutes_planned ? (d.today_minutes_done / d.today_minutes_planned) * 100 : 0
  const weekDoneMin = weekPlan.filter((p) => p.done).reduce((a, p) => a + p.minutes, 0)
  const weekTotalMin = weekPlan.reduce((a, p) => a + p.minutes, 0)
  const allTodayDone = d.today_plan.length > 0 && todayDone === d.today_plan.length
  const nextOptional = restOfWeek.find((p) => !p.done)
  const recommended = d.next_recommendation
  const stateLabel = t(({
    overdue: 'dash.state.overdue',
    today: 'dash.state.today',
    ahead: 'dash.state.ahead',
    covered: 'dash.state.covered',
    break: 'dash.state.break',
  } as const)[d.today_state])

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
          {d.current_week_label} · {t('dash.weekProgress', { done: fmtHours(weekDoneMin / 60), total: fmtHours(weekTotalMin / 60) })} · {stateLabel}
          {d.days_ahead > 0 && t('dash.daysAhead', { n: d.days_ahead })}
        </p>
      </div>

      <Card style={{ marginBottom: 14, borderColor: allTodayDone ? 'var(--success)' : 'var(--accent)' }}>
        <CardHead
          title={d.today_plan.length ? t('dash.todayMinutes', { n: d.today_minutes_planned }) : t('common.today')}
          icon={allTodayDone ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : <Flame size={16} style={{ color: 'var(--accent)' }} />}
          right={d.today_plan.length ? <Badge tone={allTodayDone ? 'success' : 'accent'}>
            {todayActivities.length
              ? t('dash.activityCount', { done: todayActivitiesDone, total: todayActivities.length })
              : `${todayDone}/${d.today_plan.length}`}
          </Badge> : undefined}
        />

        {d.today_plan.length === 0 ? (
          <div className="empty">
            <Coffee size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div><strong>{d.today_state === 'break' ? t('dash.breakTitle') : d.today_state === 'covered' ? t('dash.coveredTitle') : t('dash.noTaskTitle')}</strong></div>
            <div className="small" style={{ marginTop: 4 }}>
              {d.today_state === 'break'
                ? t('dash.breakBody')
                : d.today_state === 'covered'
                  ? t('dash.coveredBody')
                  : recommended
                    ? t('dash.aheadBody')
                    : t('dash.noSession')}
            </div>
            {recommended && (
              <div className="row wrap" style={{ justifyContent: 'center', gap: 8, marginTop: 10 }}>
                <Badge tone="accent">{recommended.title} · {recommended.minutes} min</Badge>
                <Link to="/roadmap" className="btn btn-sm btn-primary">{t('dash.viewRecommendation')} <ArrowRight size={13} /></Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="col" style={{ gap: 8 }}>
              {d.today_plan.map((p) => <DaySession key={p.id} plan={p} />)}
            </div>
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={todayPct} tone={allTodayDone ? 'var(--success)' : undefined} />
            </div>
            <div className="row between small dim" style={{ marginTop: 6 }}>
              <span>{t('dash.minutesDone', { done: d.today_minutes_done, planned: d.today_minutes_planned })}</span>
              <strong>{Math.round(todayPct)}%</strong>
            </div>
            {d.today_extra_minutes > 0 && (
              <div className="small" style={{ color: 'var(--success)', marginTop: 7 }}>
                {t('dash.extraMinutes', { n: d.today_extra_minutes, titles: d.today_extra_titles.join(', ') })}
              </div>
            )}
            {recommended && (d.today_state === 'overdue' || allTodayDone) && (
              <div className="done-next-card" style={{ borderColor: d.today_state === 'overdue' ? 'var(--danger)' : undefined }}>
                <div>
                  <strong>{d.today_state === 'overdue' ? t('dash.state.overdue') : t('dash.nextRecommendation')}</strong>
                  <div className="small dim" style={{ marginTop: 3 }}>
                    {d.today_state === 'overdue' ? t('dash.overdueBody') : t('dash.doneNextBody')}
                  </div>
                  <div className="small" style={{ marginTop: 7 }}>
                    <strong>{recommended.title}</strong> · {recommended.minutes} min
                  </div>
                </div>
                <Link to="/roadmap" className="btn btn-sm btn-primary">{t('dash.openTask')} <ArrowRight size={13} /></Link>
              </div>
            )}
            {allTodayDone && (
              <>
                <p className="small" style={{ color: 'var(--success)', marginBottom: 8, marginTop: 8 }}>
                  {t('dash.doneToday', { n: d.today_minutes_done })}
                </p>
                <div className="done-next-card">
                  <div>
                    <strong>{t('dash.wantMore')}</strong>
                    <div className="small dim" style={{ marginTop: 3 }}>
                      {t('dash.wantMoreBody')}
                    </div>
                    {nextOptional && (
                      <div className="small" style={{ marginTop: 7 }}>
                        {t('dash.nextLabel')} <strong>{nextOptional.title}</strong> · {nextOptional.minutes} min
                      </div>
                    )}
                  </div>
                  <div className="row wrap" style={{ gap: 6, flexShrink: 0 }}>
                    {nextOptional && !nextOptional.started && (
                      <Link to="/roadmap" className="btn btn-sm">{t('dash.reviewNext')}</Link>
                    )}
                    {nextOptional && !nextOptional.started && (
                      <button className="btn btn-sm btn-primary" onClick={() => startDayPlan(nextOptional)}>
                        {t('dash.start')} <ArrowRight size={13} />
                      </button>
                    )}
                    {nextOptional?.started && (
                      <button className="btn btn-sm btn-primary" onClick={() => completeDayPlan(nextOptional)}>
                        {t('dash.markComplete')} <CheckCircle2 size={13} />
                      </button>
                    )}
                    {!nextOptional && <Link to="/roadmap" className="btn btn-sm btn-primary">{t('dash.exploreRoadmap')} <ArrowRight size={13} /></Link>}
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
          <div className="stat-label">{t('dash.thisWeek')}</div>
          <div className="stat-value">{fmtHours(d.hours_this_week)}</div>
          <div className="stat-sub">{t('dash.ofTarget', { target: fmtHours(d.weekly_target) })}</div>
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
          <div className="stat-sub">{t('dash.streakDays')}</div>
        </Card>
        <Card>
          <div className="stat-label">{t('dash.planLeft')}</div>
          <div className="stat-value">{d.plan_days_remaining}</div>
          <div className="stat-sub">{t('dash.planEnds', { date: d.estimated_completion_date ? fmtDate(d.estimated_completion_date, lang) : '—' })}</div>
          <div className="small dim" style={{ marginTop: 4 }}>{t('dash.deadlineLine', { n: d.days_to_core })}</div>
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
                  {t('dash.behindWarning', { hours: Math.abs(d.pace_delta_hours) })}
                </span>
              </div>
            </Card>
          )}
          {d.questions_due > 0 && (
            <Card>
              <div className="row" style={{ gap: 10 }}>
                <Brain size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="small" style={{ flex: 1 }}>
                  {t('dash.questionsDue', { n: d.questions_due })}
                </span>
                <Link to="/interview" className="btn btn-sm">{t('dash.reviewQuestions')} <ArrowRight size={13} /></Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- semana + grafico */}
      <div className="grid grid-main">
      <Card>
        <CardHead
          title={t('dash.restOfWeek')}
          icon={<CalendarDays size={16} style={{ color: 'var(--accent)' }} />}
          right={<Link to="/roadmap" className="btn btn-sm">{t('dash.viewRoadmap')} <ArrowRight size={13} /></Link>}
        />
        {restOfWeek.length === 0 ? (
          <Empty>{t('dash.weekClosed')}</Empty>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            <div className="small dim" style={{ marginBottom: 2 }}>{t('dash.afterToday')}</div>
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
          title={t('dash.hoursPerWeek')}
          icon={<TrendingUp size={16} style={{ color: 'var(--accent)' }} />}
          right={<Link to="/progress" className="btn btn-sm">{t('dash.moreCharts')} <ArrowRight size={13} /></Link>}
        />
        <WeeklyHoursChart data={weekChart} height={190} />
      </Card>
      </div>
    </>
  )
}
