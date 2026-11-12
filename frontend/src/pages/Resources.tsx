import { useMemo, useState } from 'react'
import { ExternalLink, Pencil, Plus, Star, Trash2 } from 'lucide-react'

import { Badge, Card, Empty, Modal, PRIORITY_TONE, ProgressBar, STATUS_TONE } from '../components/ui'
import { Logo } from '../lib/logos'
import type { Resource } from '../lib/api'
import { useData, usePrefs, useT } from '../store/useStore'

const STATUSES = ['Backlog', 'In Progress', 'Done', 'Dropped']
const KINDS = ['Course', 'Practice Track', 'Docs', 'Reference', 'Video Series', 'Book']
const PRICES = ['Free', 'Free audit / paid cert', 'Paid']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Optional']

type Draft = {
  name: string
  provider: string
  kind: string
  url: string
  price: string
  estimated_hours: number
  priority: string
  status: string
  verdict: string
  skill_ids: number[]
}

const emptyDraft = (): Draft => ({
  name: '', provider: '', kind: 'Course', url: '', price: 'Free',
  estimated_hours: 0, priority: 'Medium', status: 'Backlog', verdict: '', skill_ids: [],
})

function ResourceForm({ initial, onClose }: { initial?: Resource; onClose: () => void }) {
  const t = useT()
  const { skills, createResource, patchResource } = useData()
  const [draft, setDraft] = useState<Draft>(
    initial
      ? {
          name: initial.name, provider: initial.provider, kind: initial.kind, url: initial.url,
          price: initial.price, estimated_hours: initial.estimated_hours, priority: initial.priority,
          status: initial.status, verdict: initial.verdict, skill_ids: initial.skills.map((s) => s.id),
        }
      : emptyDraft(),
  )
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const submit = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      if (initial) await patchResource(initial.id, { ...draft })
      else await createResource({ ...draft })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={initial ? initial.name : t('res.title')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !draft.name.trim()}>{t('common.save')}</button>
        </>
      }
    >
      <div className="col" style={{ gap: 12 }}>
        <label className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('res.title')}</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </label>
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="col" style={{ gap: 5, flex: 1, minWidth: 160 }}>
            <span className="small muted">Provider</span>
            <input value={draft.provider} onChange={(e) => set('provider', e.target.value)} />
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('res.hours')}</span>
            <input type="number" min={0} step={0.5} value={draft.estimated_hours}
              onChange={(e) => set('estimated_hours', Number(e.target.value))} style={{ width: 110 }} />
          </label>
        </div>
        <label className="col" style={{ gap: 5 }}>
          <span className="small muted">URL</span>
          <input value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
        </label>
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">Kind</span>
            <select value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">Price</span>
            <select value={draft.price} onChange={(e) => set('price', e.target.value)}>
              {PRICES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('task.status')}</span>
            <select value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">Status</span>
            <select value={draft.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('res.verdict')}</span>
          <textarea rows={2} value={draft.verdict} onChange={(e) => set('verdict', e.target.value)} />
        </label>
        <div className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('nav.skills')}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {skills.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`btn btn-sm ${draft.skill_ids.includes(s.id) ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() =>
                  set('skill_ids', draft.skill_ids.includes(s.id)
                    ? draft.skill_ids.filter((x) => x !== s.id)
                    : [...draft.skill_ids, s.id])}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function Resources() {
  const t = useT()
  const theme = usePrefs((s) => s.theme)
  const { resources, patchResource, removeResource } = useData()
  const [tab, setTab] = useState('active')
  const [editing, setEditing] = useState<Resource | null>(null)
  const [creating, setCreating] = useState(false)

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
          <span className="small">{t('res.plannedHours', { n: totalHours })}</span>
          <span className="small">{t('res.freeCount', { n: freeCount })}</span>
          <span className="small muted">{t('res.noCoursera')}</span>
          <span className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={14} /> {t('res.title')}</button>
        </div>
      </Card>

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          {t('res.active', { n: resources.filter((r) => r.status !== 'Dropped').length })}
        </button>
        <button className={`tab ${tab === 'dropped' ? 'active' : ''}`} onClick={() => setTab('dropped')}>
          {t('res.dropped', { n: resources.filter((r) => r.status === 'Dropped').length })}
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
                    <span className="spacer" />
                    <button className="btn btn-ghost btn-icon" onClick={() => setEditing(r)} aria-label={t('cv.edit')}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => { if (confirm(`${t('cv.reject')} · ${r.name}?`)) removeResource(r.id) }} aria-label={t('cv.reject')}><Trash2 size={14} /></button>
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
                  <div style={{ maxWidth: 520, marginBottom: 10 }}>
                    <div className="row between small dim">
                      <span>{r.activities_total
                        ? t('res.progressActivities', { done: r.activities_done, total: r.activities_total })
                        : t('res.progressTasks', { done: r.tasks_done, total: r.tasks_total })}</span>
                      <span>{t('res.loggedHours', { n: r.hours_logged })}</span>
                    </div>
                    <ProgressBar value={r.activities_total ? (r.activities_done / r.activities_total) * 100 : r.tasks_total ? (r.tasks_done / r.tasks_total) * 100 : 0} thin />
                  </div>
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

      {creating && <ResourceForm onClose={() => setCreating(false)} />}
      {editing && <ResourceForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
