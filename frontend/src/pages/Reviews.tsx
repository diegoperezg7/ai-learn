import { useState } from 'react'
import { CheckCircle2, ClipboardList } from 'lucide-react'

import { Badge, Card, Empty, ProgressBar, fmtHours } from '../components/ui'
import type { WeeklyReview } from '../lib/api'
import { useData, useT } from '../store/useStore'

const FIELDS: { key: keyof WeeklyReview; label: string; placeholder: string }[] = [
  { key: 'built', label: 'Qué he construido', placeholder: 'Código, sistemas, documentos…' },
  { key: 'learned', label: 'Conceptos aprendidos', placeholder: 'Lo que ahora entiendo y antes no' },
  { key: 'cannot_explain_yet', label: 'Lo que todavía NO puedo explicar', placeholder: 'Sé honesto: esto marca la semana siguiente' },
  { key: 'without_ai', label: 'Qué hice sin IA', placeholder: 'Modo entrenamiento' },
  { key: 'with_ai', label: 'Qué hice con IA', placeholder: 'Modo producción' },
  { key: 'blockers', label: 'Bloqueos', placeholder: 'Qué me frenó' },
  { key: 'biggest_weakness', label: 'Mayor debilidad actual', placeholder: '' },
  { key: 'biggest_improvement', label: 'Mayor mejora', placeholder: '' },
  { key: 'next_week_goal', label: 'Objetivo de la próxima semana', placeholder: '' },
]

function ReviewCard({ review }: { review: WeeklyReview }) {
  const t = useT()
  const { patchReview } = useData()
  const [open, setOpen] = useState(review.is_current)
  const [local, setLocal] = useState(review)

  const commit = (key: keyof WeeklyReview, value: string | number | boolean) => {
    setLocal({ ...local, [key]: value } as WeeklyReview)
    patchReview(review.id, { [key]: value } as Partial<WeeklyReview>)
  }

  const pct = review.target_hours ? (review.actual_hours / review.target_hours) * 100 : 0

  return (
    <Card style={review.is_current ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } : undefined}>
      <div role="button" tabIndex={0} className="row" style={{ gap: 10, cursor: 'pointer' }}
        onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}>
        <ClipboardList size={16} style={{ color: review.done ? 'var(--success)' : 'var(--text-dim)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 650 }}>{review.label}</div>
          <div className="small dim">{review.start_date} → {review.end_date}</div>
        </div>
        {review.is_current && <Badge tone="accent">Actual</Badge>}
        {review.done && <Badge tone="success"><CheckCircle2 size={11} />Cerrada</Badge>}
        <Badge tone={pct >= 100 ? 'success' : pct > 0 ? 'warning' : ''}>
          {fmtHours(review.actual_hours)} / {fmtHours(review.target_hours)}
        </Badge>
      </div>

      <div style={{ marginTop: 10 }}><ProgressBar value={pct} tone={pct >= 100 ? 'var(--success)' : undefined} thin /></div>

      {open && (
        <div className="col" style={{ gap: 10, marginTop: 14 }}>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Ejercicios Exercism</label>
              <input type="number" min={0} value={local.exercism_done}
                onChange={(e) => commit('exercism_done', Number(e.target.value))} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Preguntas de entrevista superadas</label>
              <input type="number" min={0} value={local.interview_qs_passed}
                onChange={(e) => commit('interview_qs_passed', Number(e.target.value))} />
            </div>
          </div>

          {FIELDS.map((f) => (
            <div className="field" style={{ margin: 0 }} key={String(f.key)}>
              <label>{f.label}</label>
              <textarea
                value={String(local[f.key] ?? '')}
                placeholder={f.placeholder}
                style={{ minHeight: 62 }}
                onChange={(e) => setLocal({ ...local, [f.key]: e.target.value } as WeeklyReview)}
                onBlur={(e) => patchReview(review.id, { [f.key]: e.target.value } as Partial<WeeklyReview>)}
              />
            </div>
          ))}

          <button className={`btn ${local.done ? '' : 'btn-primary'}`} onClick={() => commit('done', !local.done)}>
            <CheckCircle2 size={14} />{local.done ? 'Reabrir' : t('rev.markDone')}
          </button>
        </div>
      )}
    </Card>
  )
}

export function Reviews() {
  const t = useT()
  const { reviews } = useData()

  return (
    <>
      <div className="page-head">
        <h2>{t('rev.title')}</h2>
        <p>{t('rev.subtitle')}</p>
      </div>
      {reviews.length === 0 ? <Empty>{t('common.empty')}</Empty> : (
        <div className="col" style={{ gap: 10 }}>
          {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </>
  )
}
