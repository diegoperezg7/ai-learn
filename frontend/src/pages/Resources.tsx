import { useMemo, useState } from 'react'
import { ExternalLink, Star } from 'lucide-react'

import { Badge, Card, Empty, PRIORITY_TONE, STATUS_TONE } from '../components/ui'
import { Logo } from '../lib/logos'
import { useData, usePrefs, useT } from '../store/useStore'

const STATUSES = ['Backlog', 'In Progress', 'Done', 'Dropped']

export function Resources() {
  const t = useT()
  const theme = usePrefs((s) => s.theme)
  const { resources, patchResource } = useData()
  const [tab, setTab] = useState('active')

  const list = useMemo(() => {
    const filtered = tab === 'active' ? resources.filter((r) => r.status !== 'Dropped') : resources.filter((r) => r.status === 'Dropped')
    const order = ['Critical', 'High', 'Medium', 'Optional']
    return [...filtered].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority) || a.estimated_hours - b.estimated_hours)
  }, [resources, tab])

  const totalHours = resources.filter((r) => r.status !== 'Dropped').reduce((a, r) => a + r.estimated_hours, 0)
  const freeCount = resources.filter((r) => r.status !== 'Dropped' && r.price === 'Free').length

  return (
    <>
      <div className="page-head">
        <h2>{t('res.title')}</h2>
        <p>{t('res.subtitle')}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 14 }}>
          <span className="small"><strong>{totalHours}</strong> h totales planificadas</span>
          <span className="small"><strong>{freeCount}</strong> recursos 100% gratuitos</span>
          <span className="small muted">Ninguno requiere Coursera Plus</span>
        </div>
      </Card>

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          Activos ({resources.filter((r) => r.status !== 'Dropped').length})
        </button>
        <button className={`tab ${tab === 'dropped' ? 'active' : ''}`} onClick={() => setTab('dropped')}>
          Descartados ({resources.filter((r) => r.status === 'Dropped').length})
        </button>
      </div>

      {list.length === 0 ? <Empty>{t('common.empty')}</Empty> : (
        <div className="col" style={{ gap: 10 }}>
          {list.map((r) => (
            <Card key={r.id}>
              <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <Logo icon={r.icon} size="lg" dark={theme === 'dark'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 8, marginBottom: 5 }}>
                    <strong style={{ fontSize: 14.5 }}>{r.name}</strong>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                    <Badge>{r.provider}</Badge>
                    <Badge>{r.kind}</Badge>
                    <Badge tone={r.price === 'Free' ? 'success' : r.price === 'Paid' ? 'danger' : 'warning'}>{r.price}</Badge>
                    <Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge>
                    <Badge>{r.estimated_hours} {t('res.hours')}</Badge>
                    {r.rating != null && <Badge tone="accent"><Star size={11} fill="currentColor" />{r.rating}</Badge>}
                    {r.skills.map((s) => (
                      <span key={s.id} className="badge">{s.name}</span>
                    ))}
                  </div>
                  {r.verdict && <p className="small muted" style={{ margin: '0 0 8px' }}><strong>{t('res.verdict')}: </strong>{r.verdict}</p>}
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    <select
                      value={r.status}
                      onChange={(e) => patchResource(r.id, { status: e.target.value })}
                      style={{ width: 'auto', padding: '3px 8px', fontSize: 12.5 }}
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
