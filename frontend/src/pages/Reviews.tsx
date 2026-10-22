import { useState } from 'react'
import { CheckCircle2, ClipboardList } from 'lucide-react'

import { Badge, Card, Empty, ProgressBar, fmtHours } from '../components/ui'
import type { TKey } from '../i18n'
import type { WeeklyReview } from '../lib/api'
import { useData, useT } from '../store/useStore'

const FIELDS: { key: keyof WeeklyReview; label: TKey; placeholder: TKey | null }[] = [
  { key: 'built', label: 'rev.built', placeholder: 'rev.builtPh' },
  { key: 'learned', label: 'rev.learned', placeholder: 'rev.learnedPh' },
  { key: 'cannot_explain_yet', label: 'rev.cannot', placeholder: 'rev.cannotPh' },
  { key: 'without_ai', label: 'rev.withoutAi', placeholder: 'rev.withoutAiPh' },
  { key: 'with_ai', label: 'rev.withAi', placeholder: 'rev.withAiPh' },
  { key: 'blockers', label: 'rev.blockers', placeholder: 'rev.blockersPh' },
  { key: 'biggest_weakness', label: 'rev.weakness', placeholder: null },
  { key: 'biggest_improvement', label: 'rev.improvement', placeholder: null },
  { key: 'next_week_goal', label: 'rev.nextGoal', placeholder: null },
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
        {review.is_current && <Badge tone="accent">{t('rev.current')}</Badge>}
        {review.done && <Badge tone="success"><CheckCircle2 size={11} />{t('rev.closed')}</Badge>}
        <Badge tone={pct >= 100 ? 'success' : pct > 0 ? 'warning' : ''}>
          {fmtHours(review.actual_hours)} / {fmtHours(review.target_hours)}
        </Badge>
      </div>

      <div style={{ marginTop: 10 }}><ProgressBar value={pct} tone={pct >= 100 ? 'var(--success)' : undefined} thin /></div>

      {open && (
        <div className="col" style={{ gap: 10, marginTop: 14 }}>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>{t('rev.exercism')}</label>
              <input type="number" min={0} value={local.exercism_done}
                onChange={(e) => commit('exercism_done', Number(e.target.value))} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>{t('rev.interviewPassed')}</label>
              <input type="number" min={0} value={local.interview_qs_passed}
                onChange={(e) => commit('interview_qs_passed', Number(e.target.value))} />
            </div>
          </div>

          {FIELDS.map((f) => (
            <div className="field" style={{ margin: 0 }} key={String(f.key)}>
              <label>{t(f.label)}</label>
              <textarea
                value={String(local[f.key] ?? '')}
                placeholder={f.placeholder ? t(f.placeholder) : ''}
                style={{ minHeight: 62 }}
                onChange={(e) => setLocal({ ...local, [f.key]: e.target.value } as WeeklyReview)}
                onBlur={(e) => patchReview(review.id, { [f.key]: e.target.value } as Partial<WeeklyReview>)}
              />
            </div>
          ))}

          <button className={`btn ${local.done ? '' : 'btn-primary'}`} onClick={() => commit('done', !local.done)}>
            <CheckCircle2 size={14} />{local.done ? t('rev.reopen') : t('rev.markDone')}
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
