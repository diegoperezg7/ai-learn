import { useEffect, useState } from 'react'
import { BookMarked, CalendarClock, RefreshCw, Save } from 'lucide-react'

import { Card, CardHead, Modal } from '../components/ui'
import type { TKey } from '../i18n'
import { useData, useT } from '../store/useStore'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

export function Settings() {
  const t = useT()
  const { settings, saveSettings, regeneratePlan, syncVault } = useData()

  const [startDate, setStartDate] = useState('')
  const [weeklyHours, setWeeklyHours] = useState(6)
  const [rest, setRest] = useState<number[]>([])
  const [coreDeadline, setCoreDeadline] = useState('')
  const [finalDeadline, setFinalDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmFull, setConfirmFull] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!settings) return
    setStartDate(settings.start_date)
    setWeeklyHours(settings.weekly_target_hours)
    setRest(settings.rest_weekdays)
    setCoreDeadline(settings.core_deadline)
    setFinalDeadline(settings.final_deadline)
  }, [settings])

  if (!settings) return null

  const toggleRest = (d: number) =>
    setRest((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)))

  const save = async () => {
    setSaving(true)
    try {
      await saveSettings({
        start_date: startDate,
        weekly_target_hours: Number(weeklyHours),
        rest_weekdays: rest,
        core_deadline: coreDeadline,
        final_deadline: finalDeadline,
      })
    } finally {
      setSaving(false)
    }
  }

  const regenerate = async (mode: 'from_today' | 'full') => {
    setBusy(true)
    try {
      await regeneratePlan(mode)
    } finally {
      setBusy(false)
      setConfirmFull(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>{t('settings.title')}</h2>
        <p>{t('settings.subtitle')}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardHead title={t('settings.title')} icon={<CalendarClock size={16} />} />
        <div className="col" style={{ gap: 16, maxWidth: 440 }}>
          <label className="col" style={{ gap: 6 }}>
            <span className="small muted">{t('settings.startDate')}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>

          <label className="col" style={{ gap: 6 }}>
            <span className="small muted">{t('settings.weeklyHours')}</span>
            <input
              type="number"
              min={1}
              max={40}
              step={0.5}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              style={{ maxWidth: 120 }}
            />
          </label>

          <div className="col" style={{ gap: 6 }}>
            <span className="small muted">{t('settings.restDays')}</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`btn btn-sm ${rest.includes(d) ? 'btn-primary' : 'btn-ghost'}`}
                  aria-pressed={rest.includes(d)}
                  onClick={() => toggleRest(d)}
                >
                  {t(`settings.wd${d}` as TKey)}
                </button>
              ))}
            </div>
            <span className="small dim">{t('settings.restHint')}</span>
          </div>

          <div className="row wrap" style={{ gap: 16 }}>
            <label className="col" style={{ gap: 6 }}>
              <span className="small muted">{t('settings.coreDeadline')}</span>
              <input type="date" value={coreDeadline} onChange={(e) => setCoreDeadline(e.target.value)} />
            </label>
            <label className="col" style={{ gap: 6 }}>
              <span className="small muted">{t('settings.finalDeadline')}</span>
              <input type="date" value={finalDeadline} onChange={(e) => setFinalDeadline(e.target.value)} />
            </label>
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              <Save size={15} /> {t('common.save')}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title={t('settings.regenerate')} icon={<RefreshCw size={16} />} />
        <p className="small muted" style={{ marginTop: 0 }}>{t('settings.regenerateHint')}</p>
        <div className="col" style={{ gap: 12, maxWidth: 520 }}>
          <div className="row between wrap" style={{ gap: 10 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong className="small">{t('settings.regenFromToday')}</strong>
              <div className="small dim">{t('settings.regenFromTodayHint')}</div>
            </div>
            <button className="btn btn-primary" onClick={() => regenerate('from_today')} disabled={busy}>
              {t('settings.apply')}
            </button>
          </div>
          <div className="row between wrap" style={{ gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong className="small">{t('settings.regenFull')}</strong>
              <div className="small dim">{t('settings.regenFullHint')}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => setConfirmFull(true)} disabled={busy}>
              {t('settings.apply')}
            </button>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <CardHead title={t('settings.vault')} icon={<BookMarked size={16} />} />
        <p className="small muted" style={{ marginTop: 0 }}>{t('settings.vaultHint')}</p>
        <div className="col" style={{ gap: 12, maxWidth: 520 }}>
          <div className="row between wrap" style={{ gap: 10 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong className="small">{t('settings.vaultAuto')}</strong>
              <div className="small dim">{t('settings.vaultAutoHint')}</div>
            </div>
            <button
              type="button"
              className={`btn btn-sm ${settings.vault_autosync ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={settings.vault_autosync}
              onClick={() => saveSettings({ vault_autosync: !settings.vault_autosync })}
            >
              {settings.vault_autosync ? t('settings.vaultOn') : t('settings.vaultOff')}
            </button>
          </div>
          <div className="row between wrap" style={{ gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong className="small">{t('settings.vaultSyncNow')}</strong>
              <div className="small dim">{t('settings.vaultSyncNowHint')}</div>
            </div>
            <button
              className="btn btn-primary"
              disabled={syncing}
              onClick={async () => { setSyncing(true); try { await syncVault() } finally { setSyncing(false) } }}
            >
              <RefreshCw size={15} /> {t('settings.vaultSyncBtn')}
            </button>
          </div>
        </div>
      </Card>

      {confirmFull && (
        <Modal
          title={t('settings.confirmTitle')}
          onClose={() => setConfirmFull(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmFull(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={() => regenerate('full')} disabled={busy}>{t('settings.apply')}</button>
            </>
          }
        >
          <p className="small">{t('settings.confirmBody')}</p>
        </Modal>
      )}
    </>
  )
}
