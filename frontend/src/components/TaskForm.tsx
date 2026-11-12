import { useState } from 'react'

import { Modal } from './ui'
import type { Task } from '../lib/api'
import { useData, useT } from '../store/useStore'

const CATEGORIES = ['AI Engineering', 'Software Engineering', 'Cloud / Infra', 'Models / ML', 'Meta / Review']
const PHASES = ['Sprint 12w', 'Models & Advanced AI', 'Consolidation', 'Optional / Filler', 'Break']
const MODES = ['Practice', 'Theory', 'Mixed']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Optional']
const STATUSES = ['Not Started', 'In Progress', 'Completed']

type Draft = {
  title: string
  category: string
  phase: string
  week: string
  priority: string
  estimated_hours: number
  mode: string
  status: string
  deliverable: string
  description: string
  skill_ids: number[]
  resource_ids: number[]
}

const fromTask = (task?: Task): Draft => ({
  title: task?.title ?? '',
  category: task?.category ?? 'AI Engineering',
  phase: task?.phase ?? 'Sprint 12w',
  week: task?.week != null ? String(task.week) : '',
  priority: task?.priority ?? 'Medium',
  estimated_hours: task?.estimated_hours ?? 0,
  mode: task?.mode ?? 'Practice',
  status: task?.status ?? 'Not Started',
  deliverable: task?.deliverable ?? '',
  description: task?.description ?? '',
  skill_ids: task?.skills.map((s) => s.id) ?? [],
  resource_ids: task?.resources.map((r) => r.id) ?? [],
})

export function TaskForm({ initial, onClose }: { initial?: Task; onClose: () => void }) {
  const t = useT()
  const { skills, resources, createTask, patchTask } = useData()
  const [draft, setDraft] = useState<Draft>(fromTask(initial))
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const submit = async () => {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: draft.title,
        category: draft.category,
        phase: draft.phase,
        week: draft.week.trim() === '' ? null : Number(draft.week),
        priority: draft.priority,
        estimated_hours: Number(draft.estimated_hours),
        mode: draft.mode,
        status: draft.status,
        deliverable: draft.deliverable,
        description: draft.description,
        skill_ids: draft.skill_ids,
        resource_ids: draft.resource_ids,
      }
      if (initial) await patchTask(initial.id, payload)
      else await createTask(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={initial ? initial.title : t('form.newTask')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !draft.title.trim()}>{t('common.save')}</button>
        </>
      }
    >
      <div className="col" style={{ gap: 12 }}>
        <label className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('form.title')}</span>
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </label>
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('form.category')}</span>
            <select value={draft.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('form.phase')}</span>
            <select value={draft.phase} onChange={(e) => set('phase', e.target.value)}>
              {PHASES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('form.week')}</span>
            <input type="number" min={1} max={52} value={draft.week} onChange={(e) => set('week', e.target.value)} style={{ width: 90 }} />
          </label>
        </div>
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('form.priority')}</span>
            <select value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('form.mode')}</span>
            <select value={draft.mode} onChange={(e) => set('mode', e.target.value)}>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('task.status')}</span>
            <select value={draft.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="small muted">{t('form.hours')}</span>
            <input type="number" min={0} step={0.5} value={draft.estimated_hours}
              onChange={(e) => set('estimated_hours', Number(e.target.value))} style={{ width: 110 }} />
          </label>
        </div>
        <label className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('form.deliverable')}</span>
          <input value={draft.deliverable} onChange={(e) => set('deliverable', e.target.value)} />
        </label>
        <label className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('form.description')}</span>
          <textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('nav.skills')}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {skills.map((s) => (
              <button key={s.id} type="button"
                className={`btn btn-sm ${draft.skill_ids.includes(s.id) ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => set('skill_ids', draft.skill_ids.includes(s.id) ? draft.skill_ids.filter((x) => x !== s.id) : [...draft.skill_ids, s.id])}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="col" style={{ gap: 5 }}>
          <span className="small muted">{t('nav.resources')}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {resources.filter((r) => r.status !== 'Dropped').map((r) => (
              <button key={r.id} type="button"
                className={`btn btn-sm ${draft.resource_ids.includes(r.id) ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => set('resource_ids', draft.resource_ids.includes(r.id) ? draft.resource_ids.filter((x) => x !== r.id) : [...draft.resource_ids, r.id])}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
