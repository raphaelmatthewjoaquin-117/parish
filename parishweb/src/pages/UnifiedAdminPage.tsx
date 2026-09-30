import { useState } from 'react'
import { AdminEventsPage, type AdminEventsTab } from './AdminEventsPage'
import { AdminOperationsPage, type AdminOperationsTab } from './AdminOperationsPage'
import { AdminUsersPage } from './AdminUsersPage'
import { AdminCertificateRequestsPage } from './AdminCertificateRequestsPage'
import { normalizeRoleName, canAccessModule, type ModuleName } from '../utils/rbac'
import '../PagesCSS/UnifiedAdminPage.css'

type AdminSection =
  | { kind: 'events'; tab: AdminEventsTab; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'operations'; tab: AdminOperationsTab; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'users'; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'certificates'; label: string; icon: string; group: string; module?: ModuleName }

const sections: AdminSection[] = [
  { kind: 'events', tab: 'dashboard', label: 'Dashboard', icon: '▦', group: 'Overview' },
  { kind: 'events', tab: 'events', label: 'Events Management', icon: '◫', group: 'Overview' },
  { kind: 'operations', tab: 'schedule', label: 'Schedule', icon: '◷', group: 'Operations', module: 'MassSchedule' },
  { kind: 'events', tab: 'mass-schedule', label: 'Mass Schedule', icon: '☩', group: 'Operations', module: 'MassSchedule' },
  { kind: 'operations', tab: 'intentions', label: 'Mass Intentions', icon: '✦', group: 'Operations', module: 'MassSchedule' },
  { kind: 'operations', tab: 'applications', label: 'Applications', icon: '□', group: 'Operations', module: 'ServiceRequest' },
  { kind: 'events', tab: 'service-requests', label: 'Service Requests', icon: '✉', group: 'Operations', module: 'ServiceRequest' },
  { kind: 'certificates', label: 'Certificate Appointments', icon: '▣', group: 'Records', module: 'ServiceRequest' },
  { kind: 'events', tab: 'sacramental-ledger', label: 'Sacramental Ledger', icon: '✟', group: 'Records', module: 'SacramentalRecords' },
  { kind: 'operations', tab: 'finance', label: 'Finance & Reports', icon: '¤', group: 'Records', module: 'Finance' },
  { kind: 'operations', tab: 'stats', label: 'Stats & Demographics', icon: '⌁', group: 'Records', module: 'SacramentalRecords' },
  { kind: 'operations', tab: 'service-fields', label: 'Booking Form Fields', icon: '✎', group: 'Records', module: 'ServiceRequest' },
  { kind: 'events', tab: 'prayers', label: 'Prayer Requests', icon: '♡', group: 'Pastoral', module: 'PrayerRequest' },
  { kind: 'users', label: 'Staff & Roles', icon: '♙', group: 'Administration', module: 'UserManagement' },
]

function staffRoleFromToken(token: string): string {
  if (!token) return ''
  const parts = token.split('.')
  if (parts.length === 3 && parts[2]) return normalizeRoleName(parts[2])
  return normalizeRoleName(token) === '' ? '' : 'Admin'
}

export function UnifiedAdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>(sections[0])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarQuery, setSidebarQuery] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const staffRole = staffRoleFromToken(window.localStorage.getItem('adminToken') || '')
  const allowedSections = sections.filter(section => !section.module || canAccessModule(staffRole ? [staffRole] : [], section.module, 'view'))
  const visibleSection = allowedSections.includes(activeSection) ? activeSection : allowedSections[0]

  const navigate = (section: AdminSection) => {
    setActiveSection(section)
    setMobileOpen(false)
  }

  const filteredSections = allowedSections.filter(section => section.label.toLowerCase().includes(sidebarQuery.trim().toLowerCase()))

  if (!authenticated) {
    return <AdminEventsPage initialTab="dashboard" onAuthenticated={setAuthenticated} />
  }

  return (
    <section className={`unified-admin ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="admin-mobile-toggle btn btn-light shadow-sm" type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle admin navigation" aria-expanded={mobileOpen}>
        <span />
        <span />
        <span />
      </button>
      <aside className={`admin-sidebar d-flex flex-column ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-mark">SJ</div>
          <div className="admin-brand-copy"><strong>Parish office</strong><small>Administration</small></div>
          <button
            className="admin-sidebar-collapse"
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="admin-sidebar-collapse-icon" aria-hidden="true">‹</span>
          </button>
        </div>
        <label className="admin-sidebar-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={sidebarQuery}
            onChange={event => setSidebarQuery(event.target.value)}
            placeholder="Search tabs"
            aria-label="Search admin tabs"
          />
        </label>
        <nav aria-label="Admin navigation" className="admin-sidebar-nav nav flex-column gap-1">
          {filteredSections.map((section, index) => (
            <div key={`${section.kind}-${'tab' in section ? section.tab : 'users'}`}>
              {(index === 0 || filteredSections[index - 1].group !== section.group) && <p className="admin-nav-label">{section.group}</p>}
              <button className={`btn text-start ${visibleSection === section ? 'active' : ''}`} type="button" onClick={() => navigate(section)}>
                <span className="admin-nav-icon" aria-hidden="true">{section.icon}</span>
                <span className="admin-nav-text">{section.label}</span>
              </button>
            </div>
          ))}
          {filteredSections.length === 0 && <p className="admin-nav-empty">No tabs found</p>}
        </nav>
        <div className="admin-sidebar-footer"><small>Saint John Parish{staffRole ? ` · ${staffRole}` : ''}</small></div>
      </aside>
      <main className="admin-workspace">
        <div className="admin-workspace-heading d-flex align-items-center justify-content-between gap-3">
          <div><p className="eyebrow">Staff workspace</p><h1>{visibleSection.label}</h1></div>
          <button className="btn btn-dark" type="button" onClick={() => { window.localStorage.removeItem('adminToken'); window.location.reload() }}>Sign out</button>
        </div>
        {visibleSection.kind === 'events'
          ? <AdminEventsPage key={`events-${visibleSection.tab}`} initialTab={visibleSection.tab} embedded />
          : visibleSection.kind === 'operations'
            ? <AdminOperationsPage key={`operations-${visibleSection.tab}`} initialTab={visibleSection.tab} embedded />
            : visibleSection.kind === 'certificates'
              ? <AdminCertificateRequestsPage />
              : <AdminUsersPage embedded />}
      </main>
    </section>
  )
}
