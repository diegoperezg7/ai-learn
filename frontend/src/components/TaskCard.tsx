import { useState } from 'react'
import { Clock, Flame, Package, ChevronDown, ChevronRight } from 'lucide-react'

import type { Task } from '../lib/api'
import { Logo } from '../lib/logos'
import { usePrefs, useData, useT } from '../store/useStore'
import { Badge, Checkbox, CATEGORY_COLOR, PRIORITY_TONE, fmtDate, fmtHours } from './ui'

const DONE = new Set(['Completed', 'Interview Ready'])

export function TaskCard({ task, showDates = true }: { task: Task; showDates?: boolean }) {
  const [open, setOpen] = useState(false)
  const t = useT()
  const lang = usePrefs((s) => s.lang)
  const theme = usePrefs((s) => s.theme)
  const { setTaskStatus, toggleFocus, toggleChecklist } = useData()

  const done = DONE.has(task.status)
  const checkDone = task.checklist.filter((c) => c.done).length

  return (
    <div className={`task ${done ? 'done' : ''} ${task.today_focus ? 'focus' : ''}`}>
      <Checkbox
        checked={done}
        label={task.title}
        onChange={(v) => setTaskStatus(task.id, v ? 'Completed' : 'Not Started')}
      />

      <div className="task-body">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className={`task-title ${done ? 'strike' : ''}`} style={{ flex: 1 }}>{task.title}</span>
          <button
            className="btn btn-ghost btn-icon"
            title={t('task.markFocus')}
            onClick={() => toggleFocus(task)}
            style={{ color: task.today_focus ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            <Flame size={15} fill={task.today_focus ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="task-meta">
          <span className="badge" style={{ background: `${CATEGORY_COLOR[task.category]}1f`, color: CATEGORY_COLOR[task.category], borderColor: 'transparent' }}>
            {task.category}
          </span>
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
          <Badge>{task.mode}</Badge>
          {task.week != null && <Badge>S{task.week}</Badge>}
          {showDates && task.deadline && (
            <span className="badge"><Clock size={11} />{fmtDate(task.deadline, lang)}</span>
          )}
          <span className="badge">
            {fmtHours(task.actual_hours)} / {fmtHours(task.estimated_hours)}
          </span>
          {task.skills.slice(0, 4).map((s) => (
            <span key={s.id} title={s.name}><Logo icon={s.icon} size="sm" dark={theme === 'dark'} /></span>
          ))}
        </div>

        {(task.deliverable || task.checklist.length > 0 || task.resources.length > 0) && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', padding: '3px 6px' }} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {task.checklist.length > 0 ? `${t('task.checklist')} ${checkDone}/${task.checklist.length}` : t('task.deliverable')}
          </button>
        )}

        {open && (
          <div className="col" style={{ gap: 10, paddingTop: 4 }}>
            {task.deliverable && (
              <div className="small" style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <Package size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--accent)' }} />
                <span className="muted">{task.deliverable}</span>
              </div>
            )}

            {task.checklist.length > 0 && (
              <div className="col" style={{ gap: 5 }}>
                {task.checklist.map((c) => (
                  <label key={c.id} className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                    <Checkbox checked={c.done} onChange={(v) => toggleChecklist(task.id, c.id, v)} label={c.text} />
                    <span className={c.done ? 'strike' : ''}>{c.text}</span>
                  </label>
                ))}
              </div>
            )}

            {task.resources.length > 0 && (
              <div className="row wrap" style={{ gap: 6 }}>
                {task.resources.map((r) => (
                  <a key={r.id} className="badge" href={r.url} target="_blank" rel="noreferrer">
                    <Logo icon={r.icon} size="sm" chip={false} dark={theme === 'dark'} />
                    {r.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
