import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  BarChart3, Bell, BookOpen, Brain, CalendarDays, ClipboardList, FileText, GaugeCircle,
  Languages, LayoutDashboard, ListChecks, Menu, Moon, Rocket, Sun, Target, X,
} from 'lucide-react'

import { Badge, Card, Empty } from './components/ui'
import { CV } from './pages/CV'
import { Coach } from './pages/Coach'
import { Dashboard } from './pages/Dashboard'
import { ProgressPage } from './pages/Progress'
import { Interview } from './pages/Interview'
import { CalendarPage, Timeline } from './pages/Plan'
import { Resources } from './pages/Resources'
import { Reviews } from './pages/Reviews'
import { Roadmap } from './pages/Roadmap'
import { Skills } from './pages/Skills'
import { useData, usePrefs, useT } from './store/useStore'

const NAV = [
  { section: 'nav.overview', items: [{ to: '/', icon: LayoutDashboard, label: 'nav.dashboard' }] },
  {
    section: 'nav.plan',
    items: [
      { to: '/roadmap', icon: ListChecks, label: 'nav.roadmap' },
      { to: '/timeline', icon: GaugeCircle, label: 'nav.timeline' },
      { to: '/calendar', icon: CalendarDays, label: 'nav.calendar' },
    ],
  },
  {
    section: 'nav.growth',
    items: [
      { to: '/progress', icon: BarChart3, label: 'nav.progress' },
      { to: '/skills', icon: Brain, label: 'nav.skills' },
      { to: '/resources', icon: BookOpen, label: 'nav.resources' },
      { to: '/interview', icon: Target, label: 'nav.interview' },
      { to: '/cv', icon: FileText, label: 'nav.cv' },
      { to: '/reviews', icon: ClipboardList, label: 'nav.reviews' },
      { to: '/coach', icon: Rocket, label: 'nav.coach' },
    ],
  },
] as const

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { notifications, markNotificationRead, markAllRead } = useData()

  const tone = (level: string) =>
    level === 'danger' ? 'danger' : level === 'warning' ? 'warning' : level === 'success' ? 'success' : 'info'

  return (
    <div
      style={{ position: 'absolute', top: 'calc(var(--topbar-h) - 6px)', right: 16, width: 'min(380px, calc(100vw - 32px))', zIndex: 60 }}
      onMouseLeave={onClose}
    >
      <Card style={{ boxShadow: 'var(--shadow-lg)', maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <strong style={{ flex: 1 }}>{t('notif.title')}</strong>
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}>{t('notif.markAll')}</button>
        </div>
        {notifications.length === 0 ? <Empty>{t('notif.empty')}</Empty> : (
          <div className="col" style={{ gap: 8 }}>
            {notifications.map((n) => (
              <div key={n.id} className="task" style={{ opacity: n.read ? 0.55 : 1 }}>
                <div className="task-body">
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone={tone(n.level)}>{n.level}</Badge>
                    <strong className="small" style={{ flex: 1 }}>{n.title}</strong>
                  </div>
                  {n.body && <span className="small muted">{n.body}</span>}
                </div>
                {!n.read && (
                  <button className="btn btn-ghost btn-icon" onClick={() => markNotificationRead(n.id)} aria-label="Marcar leída">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default function App() {
  const t = useT()
  const { theme, lang, toggleTheme, setLang } = usePrefs()
  const { loadAll, loaded, error, dashboard, toasts, dismissToast } = useData()
  const [navOpen, setNavOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])
  useEffect(() => { loadAll() }, [loadAll])

  // Keep the day/pace figures fresh without a reload.
  useEffect(() => {
    const id = setInterval(() => useData.getState().refreshDashboard(), 120_000)
    return () => clearInterval(id)
  }, [])

  const unread = dashboard?.unread_notifications ?? 0

  return (
    <div className="app">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} role="presentation" />}

      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Rocket size={17} /></span>
          <span>AI Mastery Hub</span>
        </div>
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="nav-section">{t(group.section as never)}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                <item.icon size={16} />
                <span>{t(item.label as never)}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="spacer" />
        {dashboard && (
          <div className="small dim" style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            {dashboard.current_week_label}
            <br />
            {dashboard.days_to_core} {t('dash.days')} → {dashboard.core_deadline}
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setNavOpen(true)} aria-label="Menú">
            <Menu size={18} />
          </button>
          <h1>{dashboard?.current_week_label ?? 'AI Mastery Hub'}</h1>
          <span className="spacer" />
          <button className="btn btn-ghost btn-icon" onClick={() => setLang(lang === 'es' ? 'en' : 'es')} title="ES / EN">
            <Languages size={17} />
            <span className="small" style={{ marginLeft: 2 }}>{lang.toUpperCase()}</span>
          </button>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label="Tema">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setBellOpen(!bellOpen)} style={{ position: 'relative' }} aria-label="Notificaciones">
            <Bell size={17} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 3, right: 3, minWidth: 15, height: 15, borderRadius: 99,
                background: 'var(--danger)', color: '#fff', fontSize: 9.5, fontWeight: 800,
                display: 'grid', placeItems: 'center', padding: '0 3px',
              }}>{unread}</span>
            )}
          </button>
        </header>

        {bellOpen && <NotificationPanel onClose={() => setBellOpen(false)} />}

        <main className="content">
          {error && (
            <Card style={{ borderColor: 'var(--danger)', marginBottom: 14 }}>
              <strong style={{ color: 'var(--danger)' }}>Error:</strong> {error}
            </Card>
          )}
          {!loaded && !error ? <Empty>{t('common.loading')}</Empty> : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/interview" element={<Interview />} />
              <Route path="/cv" element={<CV />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>

      <div className="toasts">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`} onClick={() => dismissToast(x.id)} role="presentation">
            {x.message}
          </div>
        ))}
      </div>
    </div>
  )
}
