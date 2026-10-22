import { useEffect, useMemo, useState } from 'react'
import { Check, Download, FileText, RefreshCw, Save, Sparkles, X } from 'lucide-react'

import { Badge, Card, CardHead, Empty } from '../components/ui'
import { api } from '../lib/api'
import { useData, useT } from '../store/useStore'

/** Minimal markdown renderer: headings, bullets, bold, rules. No HTML passthrough. */
function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

  const out: string[] = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (/^###\s+/.test(line)) { closeList(); out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`) }
    else if (/^##\s+/.test(line)) { closeList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`) }
    else if (/^#\s+/.test(line)) { closeList(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`) }
    else if (/^---+$/.test(line)) { closeList(); out.push('<hr/>') }
    else if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
    } else if (line.trim() === '') { closeList() }
    else { closeList(); out.push(`<p>${inline(line)}</p>`) }
  }
  closeList()
  return out.join('')
}

export function CV() {
  const t = useT()
  const { suggestions, loadSuggestions, acceptSuggestion, rejectSuggestion, toast } = useData()
  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const doc = await api.cv()
    setContent(doc.content)
    setDraft(doc.content)
  }

  useEffect(() => {
    load()
    loadSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const html = useMemo(() => renderMarkdown(content), [content])

  const save = async () => {
    setBusy(true)
    try {
      const doc = await api.saveCV(draft)
      setContent(doc.content)
      setEditing(false)
      toast(t('cv.saved'), 'success')
    } finally {
      setBusy(false)
    }
  }

  const sync = async () => {
    setBusy(true)
    try {
      const res = await api.syncCV()
      await loadSuggestions()
      toast(res.created ? t('cv.newSuggestions', { n: res.created }) : t('cv.noNews'))
    } finally {
      setBusy(false)
    }
  }

  const accept = async (id: number) => {
    await acceptSuggestion(id)
    await load()
  }

  const download = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cv.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-head">
        <h2>{t('cv.title')}</h2>
        <p>{t('cv.subtitle')}</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardHead
          title={t('cv.suggestions')}
          icon={<Sparkles size={16} style={{ color: 'var(--accent)' }} />}
          right={
            <>
              <Badge tone={suggestions.length ? 'accent' : ''}>{suggestions.length}</Badge>
              <button className="btn btn-sm" onClick={sync} disabled={busy}><RefreshCw size={13} />{t('cv.sync')}</button>
            </>
          }
        />
        {suggestions.length === 0 ? (
          <Empty>{t('cv.noSuggestions')}</Empty>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {suggestions.map((s) => (
              <div key={s.id} className="task">
                <div className="task-body">
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone="info">{s.section}</Badge>
                    <span style={{ flex: 1, fontWeight: 550 }}>{s.content}</span>
                  </div>
                  <span className="small dim">{s.rationale}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => accept(s.id)}><Check size={13} />{t('cv.accept')}</button>
                  <button className="btn btn-sm" onClick={() => rejectSuggestion(s.id)}><X size={13} />{t('cv.reject')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title={t('cv.title')}
          icon={<FileText size={16} style={{ color: 'var(--accent)' }} />}
          right={
            editing ? (
              <>
                <button className="btn btn-sm" onClick={() => { setDraft(content); setEditing(false) }}>{t('common.cancel')}</button>
                <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}><Save size={13} />{t('common.save')}</button>
              </>
            ) : (
              <>
                <button className="btn btn-sm" onClick={download}><Download size={13} />{t('cv.download')}</button>
                <button className="btn btn-sm" onClick={() => setEditing(true)}>{t('cv.edit')}</button>
              </>
            )
          }
        />
        {editing ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 520, fontFamily: 'var(--mono)', fontSize: 13 }} />
        ) : (
          <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </Card>
    </>
  )
}
