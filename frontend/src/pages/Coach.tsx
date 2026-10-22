import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bot, Send, Sparkles } from 'lucide-react'

import { Badge, Card, Empty } from '../components/ui'
import { api } from '../lib/api'
import type { CoachHealth } from '../lib/api'
import { useT } from '../store/useStore'

type Turn = { role: 'user' | 'assistant'; content: string }
const ROLES = ['coach', 'interviewer', 'reviewer'] as const

export function Coach() {
  const t = useT()
  const [health, setHealth] = useState<CoachHealth | null>(null)
  const [role, setRole] = useState<(typeof ROLES)[number]>('coach')
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.coachHealth().then(setHealth).catch(() => setHealth({ available: false, url: '', model: '' })) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, busy])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const next: Turn[] = [...turns, { role: 'user', content: text }]
    setTurns(next)
    setInput('')
    setBusy(true)
    try {
      const res = await api.coachChat(text, role, next.slice(0, -1))
      setTurns([...next, { role: 'assistant', content: res.reply }])
    } catch (e) {
      setTurns([...next, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Error'}` }])
    } finally {
      setBusy(false)
    }
  }

  const briefing = async () => {
    setBusy(true)
    try {
      const res = await api.coachBriefing()
      setTurns([...turns, { role: 'user', content: t('coach.briefing') }, { role: 'assistant', content: res.reply }])
    } catch (e) {
      setTurns([...turns, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Error'}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>{t('coach.title')}</h2>
        <p>{t('coach.subtitle')}</p>
      </div>

      {health && !health.available && (
        <Card style={{ marginBottom: 14, borderColor: 'var(--warning)' }}>
          <div className="row" style={{ gap: 10 }}>
            <AlertTriangle size={17} style={{ color: 'var(--warning)' }} />
            <div>
              <strong>{t('coach.offline')}</strong>
              <div className="small dim">{health.url || t('coach.noUrl')} · {health.error ?? ''}</div>
            </div>
          </div>
        </Card>
      )}

      {health?.available && health.model_present === false && (
        <Card style={{ marginBottom: 14, borderColor: 'var(--warning)' }}>
          <div className="small">
            {t('coach.modelUp')} <code>{health.model}</code> {t('coach.modelMissing')}{' '}
            <code className="mono">ollama pull {health.model}</code>.
            {health.models?.length ? <> {t('coach.available')} {health.models.join(', ')}</> : null}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {ROLES.map((r) => (
            <button key={r} className={`btn btn-sm ${role === r ? 'btn-primary' : ''}`} onClick={() => setRole(r)}>
              {t(`coach.role.${r}` as never)}
            </button>
          ))}
          <span className="spacer" />
          <button className="btn btn-sm" onClick={briefing} disabled={busy || !health?.available}>
            <Sparkles size={13} />{t('coach.briefing')}
          </button>
          {health?.available && <Badge tone="success">{health.model}</Badge>}
        </div>
      </Card>

      <Card className="coach-card">
        <div className="chat coach-chat" style={{ minHeight: 320, maxHeight: '56vh', overflowY: 'auto', marginBottom: 14 }}>
          {turns.length === 0 && (
            <Empty>
              <Bot size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>{t('coach.empty')}</div>
              <div className="small" style={{ marginTop: 6 }}>{t('coach.emptyHint')}</div>
            </Empty>
          )}
          {turns.map((turn, i) => (
            <div key={i} className={`bubble ${turn.role === 'user' ? 'user' : 'bot'}`}>{turn.content}</div>
          ))}
          {busy && <div className="bubble bot dim">{t('coach.thinking')}</div>}
          <div ref={endRef} />
        </div>

        <div className="coach-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('coach.placeholder')}
            style={{ minHeight: 64 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
            }}
          />
          <button className="coach-send" onClick={() => send(input)} disabled={busy || !input.trim()} aria-label={t('coach.send')}>
            <Send size={17} />
          </button>
        </div>
        <p className="small dim coach-hint">{t('coach.hint')}</p>
      </Card>
    </>
  )
}
