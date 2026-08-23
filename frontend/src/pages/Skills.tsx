import { useMemo, useState } from 'react'
import { Award, Save } from 'lucide-react'

import { Badge, CATEGORY_COLOR, Card, Empty, Modal, PRIORITY_TONE, ProgressBar, STATUS_TONE, fmtHours } from '../components/ui'
import { Logo } from '../lib/logos'
import type { Skill } from '../lib/api'
import { useData, usePrefs, useT } from '../store/useStore'

const STATUSES = ['Not Started', 'Learning', 'Practicing', 'Interview Ready', 'Completed']
const CATEGORIES = ['AI Engineering', 'Software Engineering', 'Cloud / Infra', 'Models / ML']

function LevelBar({ current, target }: { current: number; target: number }) {
  return (
    <span className="mono" style={{ letterSpacing: 1 }} title={`${current}/${target}`}>
      {'█'.repeat(Math.max(0, current))}
      <span style={{ color: 'var(--border-strong)' }}>{'░'.repeat(Math.max(0, target - current))}</span>
    </span>
  )
}

function SkillModal({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const t = useT()
  const theme = usePrefs((s) => s.theme)
  const { patchSkill } = useData()
  const [level, setLevel] = useState(skill.current_level)
  const [status, setStatus] = useState(skill.status)
  const [evidence, setEvidence] = useState(skill.practice_evidence)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await patchSkill(skill.id, { current_level: level, status, practice_evidence: evidence })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 10 }}>
          <Logo icon={skill.icon} dark={theme === 'dark'} />
          {skill.name}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><Save size={14} />{t('common.save')}</button>
        </>
      }
    >
      <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
        <span className="badge" style={{ background: `${CATEGORY_COLOR[skill.category]}1f`, color: CATEGORY_COLOR[skill.category], borderColor: 'transparent' }}>
          {skill.category}
        </span>
        <Badge tone={PRIORITY_TONE[skill.priority]}>{skill.priority}</Badge>
        <Badge>{fmtHours(skill.hours_logged)} registradas</Badge>
        <Badge>{skill.tasks_done}/{skill.tasks_total} tareas</Badge>
        <Badge>{skill.questions_ready}/{skill.questions_total} preguntas</Badge>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>{skill.description}</p>

      {skill.why_it_matters && (
        <div className="card" style={{ background: 'var(--surface-2)', marginBottom: 14 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>{t('skills.why')}</div>
          <div className="small muted">{skill.why_it_matters}</div>
        </div>
      )}

      <div className="card" style={{ background: 'var(--warning-soft)', border: 'none', marginBottom: 16 }}>
        <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>{t('skills.criteria')}</div>
        <div className="small">{skill.completion_criteria}</div>
      </div>

      <div className="field">
        <label>{t('common.level')}: {level} / {skill.target_level}</label>
        <input type="range" min={0} max={5} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        <div className="row" style={{ gap: 8 }}>
          <LevelBar current={level} target={5} />
          <span className="small dim">
            0 nada · 1 leído · 2 usado con IA · 3 usado sin IA · 4 sé explicarlo · 5 sé diseñarlo
          </span>
        </div>
      </div>

      <div className="field">
        <label>{t('task.status')}</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="field">
        <label>{t('common.evidence')}</label>
        <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={t('skills.evidencePlaceholder')} />
      </div>
    </Modal>
  )
}

export function Skills() {
  const t = useT()
  const theme = usePrefs((s) => s.theme)
  const { skills } = useData()
  const [cat, setCat] = useState('all')
  const [selected, setSelected] = useState<Skill | null>(null)

  const groups = useMemo(() => {
    const list = cat === 'all' ? skills : skills.filter((s) => s.category === cat)
    const map = new Map<string, Skill[]>()
    list.forEach((s) => map.set(s.category, [...(map.get(s.category) ?? []), s]))
    return [...map.entries()].sort((a, b) => CATEGORIES.indexOf(a[0]) - CATEGORIES.indexOf(b[0]))
  }, [skills, cat])

  const avg = skills.length
    ? Math.round((skills.reduce((a, s) => a + s.current_level / (s.target_level || 5), 0) / skills.length) * 100)
    : 0

  return (
    <>
      <div className="page-head">
        <h2>{t('skills.title')}</h2>
        <p>{t('skills.subtitle')}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <Award size={16} style={{ color: 'var(--accent)' }} />
          <span className="small"><strong>{avg}%</strong> del nivel objetivo global</span>
          <div style={{ flex: 1, minWidth: 120 }}><ProgressBar value={avg} thin /></div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">{t('common.all')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      {groups.length === 0 ? <Empty>{t('common.empty')}</Empty> : (
        <div className="col" style={{ gap: 18 }}>
          {groups.map(([category, list]) => (
            <div key={category}>
              <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                <span className="legend-dot" style={{ background: CATEGORY_COLOR[category], width: 12, height: 12 }} />
                <h3 style={{ fontSize: 14 }}>{category}</h3>
                <Badge>{list.length}</Badge>
              </div>
              <div className="grid grid-3">
                {list.map((s) => (
                  <Card key={s.id} className="skill-card" style={{ cursor: 'pointer' }}>
                    <div role="button" tabIndex={0} onClick={() => setSelected(s)} onKeyDown={(e) => e.key === 'Enter' && setSelected(s)}>
                      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                        <Logo icon={s.icon} dark={theme === 'dark'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 650 }}>{s.name}</div>
                          <div className="small dim">{fmtHours(s.hours_logged)} · {s.tasks_done}/{s.tasks_total} tareas · {Math.round(s.evidence_percent)}% evidencia</div>
                        </div>
                        <Badge tone={PRIORITY_TONE[s.priority]}>{s.priority}</Badge>
                      </div>
                      <p className="small muted" style={{ margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {s.description}
                      </p>
                      <div className="row" style={{ gap: 8 }}>
                        <LevelBar current={s.current_level} target={s.target_level} />
                        <span className="spacer" />
                        <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <SkillModal skill={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
