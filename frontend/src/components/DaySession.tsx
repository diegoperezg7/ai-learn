import { Clock, ExternalLink } from 'lucide-react'

import type { DayPlan } from '../lib/api'
import { Logo } from '../lib/logos'
import { useData, usePrefs } from '../store/useStore'
import { Badge, Checkbox } from './ui'

/** One concrete study session. Ticking it logs its minutes automatically. */
export function DaySession({ plan, compact = false }: { plan: DayPlan; compact?: boolean }) {
  const theme = usePrefs((s) => s.theme)
  const { completeDayPlan, toggleActivity } = useData()

  return (
    <div className={`task ${plan.done ? 'done' : ''}`}>
      <Checkbox checked={plan.done} onChange={() => completeDayPlan(plan)} label={plan.title} />

      <div className="task-body">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          {plan.resource && (
            <span title={plan.resource.name}>
              <Logo icon={plan.resource.icon} size="sm" dark={theme === 'dark'} />
            </span>
          )}
          <span className={`task-title ${plan.done ? 'strike' : ''}`} style={{ flex: 1 }}>{plan.title}</span>
          <Badge tone={plan.done ? 'success' : 'accent'}>
            <Clock size={11} />{plan.minutes} min
          </Badge>
        </div>

        {!compact && plan.scope && <span className="small muted">{plan.scope}</span>}

        {!compact && plan.activities.length > 0 && (
          <div className="day-activities">
            {plan.activities.map((activity) => (
              <div key={activity.id} className="row small day-activity">
                <Checkbox checked={activity.done} onChange={(v) => toggleActivity(plan, activity.id, v)} label={activity.title} />
                <span className={activity.done ? 'strike' : ''} style={{ flex: 1 }}>{activity.title}</span>
                <span className="badge"><Clock size={10} /> {activity.minutes} min</span>
                {activity.url && <a href={activity.url} target="_blank" rel="noreferrer" className="badge"><ExternalLink size={11} /> Abrir</a>}
              </div>
            ))}
          </div>
        )}

        {!compact && plan.resource?.url && (
          <a
            className="badge"
            href={plan.resource.url}
            target="_blank"
            rel="noreferrer"
            style={{ alignSelf: 'flex-start', maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' }}
          >
            <ExternalLink size={11} /> Abrir recurso · {plan.resource.name}
          </a>
        )}
      </div>
    </div>
  )
}
