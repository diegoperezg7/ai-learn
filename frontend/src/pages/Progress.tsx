import { useMemo } from 'react'
import { Activity, Flame, PieChart as PieIcon, Radar as RadarIcon, Target, TrendingUp } from 'lucide-react'

import { CATEGORY_COLOR, Card, CardHead, Empty, fmtHours } from '../components/ui'
import {
  CumulativeChart, DistributionChart, ReadinessChart, SkillRadar, WeeklyHoursChart, useChartTheme,
} from '../components/charts'
import { useData, useT } from '../store/useStore'

const TARGET_SHARE: Record<string, number> = {
  'AI Engineering': 40,
  'Software Engineering': 30,
  'Cloud / Infra': 20,
  'Models / ML': 10,
}

const SHORT: Record<string, string> = {
  'AI Engineering': 'AI Eng',
  'Software Engineering': 'Software',
  'Cloud / Infra': 'Cloud',
  'Models / ML': 'Models',
}

export function ProgressPage() {
  const t = useT()
  const c = useChartTheme()
  const { dashboard, skills, questions, reviews, sessions } = useData()

  const weekData = useMemo(
    () => (dashboard?.week_hours ?? []).map((w) => ({ label: `S${w.week}`, target: w.target, actual: w.actual })),
    [dashboard],
  )

  const distribution = useMemo(
    () =>
      (dashboard?.category_stats ?? [])
        .filter((s) => s.planned_hours > 0)
        .map((s) => ({
          name: SHORT[s.category] ?? s.category,
          value: s.planned_hours,
          target: TARGET_SHARE[s.category],
          color: CATEGORY_COLOR[s.category] ?? c.accent,
        })),
    [dashboard, c.accent],
  )

  const radar = useMemo(() => {
    const groups = new Map<string, { actual: number; target: number; n: number }>()
    skills.forEach((s) => {
      const g = groups.get(s.category) ?? { actual: 0, target: 0, n: 0 }
      g.actual += s.current_level
      g.target += s.target_level
      g.n += 1
      groups.set(s.category, g)
    })
    return [...groups.entries()].map(([area, g]) => ({
      area: SHORT[area] ?? area,
      actual: Number((g.actual / g.n).toFixed(2)),
      target: Number((g.target / g.n).toFixed(2)),
    }))
  }, [skills])

  const cumulative = useMemo(() => {
    const rows = reviews.filter((r) => r.week_number != null).sort((a, b) => a.week_number! - b.week_number!)
    const today = dashboard?.today ?? ''
    let real = 0
    let plan = 0
    return rows.map((r) => {
      plan += r.target_hours
      real += r.actual_hours
      // No dibujes futuro: la línea real se corta en la semana en curso.
      const started = !r.start_date || r.start_date <= today
      return {
        label: `S${r.week_number}`,
        plan: Number(plan.toFixed(1)),
        real: started ? Number(real.toFixed(1)) : null,
      }
    })
  }, [reviews, dashboard])

  const readiness = useMemo(() => {
    const map = new Map<string, { ready: number; pending: number }>()
    questions.forEach((q) => {
      const g = map.get(q.area) ?? { ready: 0, pending: 0 }
      if (q.readiness === 'Interview Ready') g.ready += 1
      else g.pending += 1
      map.set(q.area, g)
    })
    return [...map.entries()]
      .map(([area, g]) => ({ area, ...g }))
      .sort((a, b) => b.ready + b.pending - (a.ready + a.pending))
  }, [questions])

  const modeSplit = useMemo(() => {
    const acc = { Practice: 0, Theory: 0, Mixed: 0 } as Record<string, number>
    sessions.forEach((s) => { acc[s.mode] = (acc[s.mode] ?? 0) + s.minutes })
    const total = Object.values(acc).reduce((a, b) => a + b, 0)
    return { acc, total, practicePct: total ? Math.round((acc.Practice / total) * 100) : 0 }
  }, [sessions])

  if (!dashboard) return <Empty>{t('common.loading')}</Empty>

  return (
    <>
      <div className="page-head">
        <h2>{t('prog.title')}</h2>
        <p>{t('prog.subtitle')}</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card>
          <CardHead title={t('dash.hoursPerWeek')} icon={<TrendingUp size={16} style={{ color: 'var(--accent)' }} />} />
          {weekData.length === 0 ? <Empty>{t('common.empty')}</Empty> : <WeeklyHoursChart data={weekData} />}
          <p className="small dim" style={{ margin: '6px 0 0' }}>
            {t('prog.weekLegend')}
          </p>
        </Card>

        <Card>
          <CardHead title={t('prog.cumulative')} icon={<Activity size={16} style={{ color: 'var(--accent)' }} />} />
          {cumulative.length === 0 ? <Empty>{t('common.empty')}</Empty> : <CumulativeChart data={cumulative} />}
          <p className="small dim" style={{ margin: '6px 0 0' }}>
            {t('prog.cumulativeHint')}
          </p>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card>
          <CardHead title={t('prog.levelByPillar')} icon={<RadarIcon size={16} style={{ color: 'var(--accent)' }} />} />
          {radar.length === 0 ? <Empty>{t('common.empty')}</Empty> : <SkillRadar data={radar} />}
          <p className="small dim" style={{ margin: '6px 0 0' }}>
            {t('prog.levelHint')}
          </p>
        </Card>

        <Card>
          <CardHead title={t('prog.sprintSplit')} icon={<PieIcon size={16} style={{ color: 'var(--accent)' }} />} />
          {distribution.length === 0 ? <Empty>{t('common.empty')}</Empty> : <DistributionChart data={distribution} />}
          <p className="small dim" style={{ margin: '6px 0 0' }}>
            {t('prog.sprintHint')}
          </p>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title={t('prog.interviewsByArea')}
            icon={<Target size={16} style={{ color: 'var(--accent)' }} />}
          />
          {readiness.length === 0 ? <Empty>{t('common.empty')}</Empty> : <ReadinessChart data={readiness} />}
          <p className="small dim" style={{ margin: '6px 0 0' }}>
            {t('prog.interviewHint')}
          </p>
        </Card>

        <Card>
          <CardHead title={t('prog.practiceVsTheory')} icon={<Flame size={16} style={{ color: 'var(--accent)' }} />} />
          {modeSplit.total === 0 ? (
            <Empty>{t('prog.emptyModes')}</Empty>
          ) : (
            <>
              <div className="row" style={{ gap: 14, marginBottom: 12 }}>
                <div className="stat">
                  <span className="stat-label">{t('prog.practice')}</span>
                  <span
                    className="stat-value"
                    style={{ color: modeSplit.practicePct >= 60 ? 'var(--success)' : 'var(--warning)' }}
                  >
                    {modeSplit.practicePct}%
                  </span>
                  <span className="stat-sub">{t('prog.target70')}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">{t('prog.totalLogged')}</span>
                  <span className="stat-value">{fmtHours(modeSplit.total / 60)}</span>
                  <span className="stat-sub">{t('prog.sessions', { n: sessions.length })}</span>
                </div>
              </div>
              <DistributionChart
                height={180}
                data={[
                  { name: t('prog.practice'), value: modeSplit.acc.Practice ?? 0, color: c.success },
                  { name: t('prog.theory'), value: modeSplit.acc.Theory ?? 0, color: c.accent },
                  { name: t('prog.mixed'), value: modeSplit.acc.Mixed ?? 0, color: c.warning },
                ].filter((d) => d.value > 0)}
              />
            </>
          )}
        </Card>
      </div>
    </>
  )
}
