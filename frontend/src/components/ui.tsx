import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>
}

export function CardHead({ title, icon, right }: { title: string; icon?: ReactNode; right?: ReactNode }) {
  return (
    <div className="card-head">
      {icon}
      <h3>{title}</h3>
      <span className="spacer" />
      {right}
    </div>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={tone ? { color: tone } : undefined}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

export function ProgressBar({ value, tone, thin }: { value: number; tone?: string; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`pbar ${thin ? 'thin' : ''}`}>
      <span style={{ width: `${pct}%`, background: tone }} />
    </div>
  )
}

export function Badge({ children, tone = '' }: { children: ReactNode; tone?: '' | 'accent' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{children}</span>
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      className={`check ${checked ? 'on' : ''}`}
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      {checked && <Check strokeWidth={3.5} />}
    </button>
  )
}

export function Modal({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 style={{ flex: 1, fontSize: 15 }}>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'info' | ''> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Optional: '',
}

export const STATUS_TONE: Record<string, 'success' | 'warning' | 'info' | 'accent' | ''> = {
  'Not Started': '',
  Learning: 'info',
  Practicing: 'warning',
  'Interview Ready': 'success',
  Completed: 'success',
  Backlog: '',
  'In Progress': 'info',
  Done: 'success',
  Dropped: '',
}

/**
 * Escala categorica de los pilares. Deliberadamente fuera de la familia del acento
 * (indigo): si un pilar se parece al color de marca, el donut deja de leerse.
 */
export const CATEGORY_COLOR: Record<string, string> = {
  'AI Engineering': '#ec4899',
  'Software Engineering': '#14b8a6',
  'Cloud / Infra': '#f59e0b',
  'Models / ML': '#22c55e',
  'Meta / Review': '#94a3b8',
}

export function fmtHours(h: number): string {
  if (!h) return '0h'
  if (h < 1) return `${Math.round(h * 60)}min`
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
}

export function fmtDate(iso: string | null, lang = 'es'): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit',
    month: 'short',
  })
}
