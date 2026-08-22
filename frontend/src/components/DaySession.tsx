import { Clock, ExternalLink } from 'lucide-react'

import type { DayPlan } from '../lib/api'
import { Logo } from '../lib/logos'
import { useData, usePrefs } from '../store/useStore'
import { Badge, Checkbox } from './ui'

const EXERCISM_ACTIVITY_LINKS: Record<string, string> = {
  "Guido's Gorgeous Lasagna": 'https://exercism.org/tracks/python/exercises/lasagna',
  'Ghost Gobble': 'https://exercism.org/tracks/python/exercises/ghost-gobble-arcade-game',
  'Currency Exchange': 'https://exercism.org/tracks/python/exercises/currency-exchange',
  'Meltdown Mitigation': 'https://exercism.org/tracks/python/exercises/meltdown-mitigation',
}

function activityLinks(plan: DayPlan) {
  if (!plan.resource || plan.resource.provider !== 'Exercism') return []
  return Object.entries(EXERCISM_ACTIVITY_LINKS)
    .filter(([label]) => plan.scope.includes(label))
    .map(([label, url]) => ({ label, url }))
}

/** One concrete study session. Ticking it logs its minutes automatically. */
export function DaySession({ plan, compact = false }: { plan: DayPlan; compact?: boolean }) {
  const theme = usePrefs((s) => s.theme)
  const { completeDayPlan } = useData()
  const links = activityLinks(plan)

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

        {!compact && plan.resource?.url && (
          <a
            className="badge"
            href={plan.resource.url}
            target="_blank"
            rel="noreferrer"
            style={{ alignSelf: 'flex-start', maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' }}
          >
            <ExternalLink size={11} /> Abrir {plan.resource.name}
          </a>
        )}
        {!compact && links.length > 0 && (
          <div className="activity-links">
            {links.map((link) => (
              <a key={link.url} className="badge" href={link.url} target="_blank" rel="noreferrer">
                <ExternalLink size={11} /> {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
