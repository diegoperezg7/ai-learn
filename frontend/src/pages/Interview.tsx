import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Badge, Card, Checkbox, Empty, ProgressBar } from '../components/ui'
import { useData, useT } from '../store/useStore'

const READINESS_TONE: Record<string, 'success' | 'warning' | 'info' | ''> = {
  'Interview Ready': 'success',
  'Can Explain Only': 'warning',
  'Can Code Only': 'info',
  'Not Ready': '',
}

export function Interview() {
  const t = useT()
  const { questions, patchQuestion } = useData()
  const [area, setArea] = useState('all')
  const [only, setOnly] = useState('all')
  const [q, setQ] = useState('')

  const areas = useMemo(() => [...new Set(questions.map((x) => x.area))].sort(), [questions])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return questions.filter((x) => {
      if (area !== 'all' && x.area !== area) return false
      if (only === 'ready' && x.readiness !== 'Interview Ready') return false
      if (only === 'pending' && x.readiness === 'Interview Ready') return false
      if (needle && !x.question.toLowerCase().includes(needle)) return false
      return true
    })
  }, [questions, area, only, q])

  const ready = questions.filter((x) => x.readiness === 'Interview Ready').length
  const pct = questions.length ? Math.round((ready / questions.length) * 100) : 0

  const byArea = useMemo(() => {
    const map = new Map<string, { total: number; ready: number }>()
    questions.forEach((x) => {
      const cur = map.get(x.area) ?? { total: 0, ready: 0 }
      cur.total += 1
      if (x.readiness === 'Interview Ready') cur.ready += 1
      map.set(x.area, cur)
    })
    return [...map.entries()].sort()
  }, [questions])

  return (
    <>
      <div className="page-head">
        <h2>{t('iv.title')}</h2>
        <p>{t('iv.subtitle')}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 18 }}>{ready} / {questions.length}</strong>
              <span className="small muted">&nbsp;{t('iv.ready').toLowerCase()}</span>
              <span className="spacer" />
              <strong>{pct}%</strong>
            </div>
            <ProgressBar value={pct} tone={pct >= 80 ? 'var(--success)' : undefined} />
          </div>
        </div>
        <div className="grid grid-4" style={{ gap: 8 }}>
          {byArea.map(([name, s]) => (
            <div key={name}>
              <div className="row small" style={{ marginBottom: 3 }}>
                <span style={{ flex: 1 }}>{name}</span>
                <span className="dim">{s.ready}/{s.total}</span>
              </div>
              <ProgressBar value={(s.ready / s.total) * 100} thin />
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="row" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} style={{ paddingLeft: 32 }} />
          </div>
          <select value={area} onChange={(e) => setArea(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">{t('common.all')}</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select value={only} onChange={(e) => setOnly(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">{t('common.all')}</option>
            <option value="pending">{t('iv.notReady')}</option>
            <option value="ready">{t('iv.ready')}</option>
          </select>
        </div>
      </Card>

      {list.length === 0 ? <Empty>{t('common.empty')}</Empty> : (
        <div className="col" style={{ gap: 8 }}>
          {list.map((x) => (
            <Card key={x.id}>
              <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 550, marginBottom: 6 }}>{x.question}</div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <Badge>{x.area}</Badge>
                    <Badge tone={x.difficulty === 'Senior' ? 'danger' : x.difficulty === 'Mid' ? 'warning' : ''}>{x.difficulty}</Badge>
                    <Badge tone={READINESS_TONE[x.readiness]}>{x.readiness}</Badge>
                    {x.last_reviewed && <span className="small dim">Revisada {x.last_reviewed}</span>}
                  </div>
                </div>
                <div className="col" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <label className="row small" style={{ gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Checkbox checked={x.can_explain} onChange={(v) => patchQuestion(x.id, { can_explain: v })} label={t('iv.explain')} />
                    {t('iv.explain')}
                  </label>
                  <label className="row small" style={{ gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Checkbox checked={x.can_implement} onChange={(v) => patchQuestion(x.id, { can_implement: v })} label={t('iv.implement')} />
                    {t('iv.implement')}
                  </label>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
