import { useCallback, useEffect, useState } from 'react'
import { AdminEventsPage, type AdminEventsTab } from './AdminEventsPage'
import { AdminOperationsPage, type AdminOperationsTab } from './AdminOperationsPage'
import { AdminUsersPage } from './AdminUsersPage'
import { AdminCertificateRequestsPage } from './AdminCertificateRequestsPage'
import { SiteContentEditorPage } from './SiteContentEditorPage'
import { AdminContactMessagesPage } from './AdminContactMessagesPage'
import { API_BASE_URL as API_URL } from '../api/client'
import { AdminProfilePage, type StaffProfile } from './AdminProfilePage'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { normalizeRoleName, effectiveModuleAccess, type ModuleName } from '../utils/rbac'
import '../PagesCSS/UnifiedAdminPage.css'

type AdminSection = (
  | { kind: 'events'; tab: AdminEventsTab; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'operations'; tab: AdminOperationsTab; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'users'; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'certificates'; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'content'; page: 'about' | 'gallery' | 'contact' | 'footer' | 'news'; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'messages'; label: string; icon: string; group: string; module?: ModuleName }
  | { kind: 'profile'; label: string; icon: string; group: string; module?: ModuleName }
) & { roles?: string[] }

const sections: AdminSection[] = [
  { kind: 'events', tab: 'dashboard', label: 'Dashboard', icon: '▦', group: 'Overview' },
  { kind: 'messages', label: 'Contact Messages', icon: '✉', group: 'Overview', module: 'ContactMessages' },
  { kind: 'events', tab: 'events', label: 'Events Management', icon: '◫', group: 'Website Content', module: 'WebsiteContent' },
  { kind: 'content', page: 'about', label: 'About Page', icon: '¶', group: 'Website Content', module: 'WebsiteContent' },
  { kind: 'content', page: 'gallery', label: 'Photo Gallery', icon: '▧', group: 'Website Content', module: 'Gallery' },
  { kind: 'content', page: 'contact', label: 'Contact Page', icon: '☎', group: 'Website Content', module: 'WebsiteContent' },
  { kind: 'content', page: 'footer', label: 'Footer', icon: '▤', group: 'Website Content', module: 'WebsiteContent' },
  { kind: 'content', page: 'news', label: 'Church News', icon: '▤', group: 'Website Content', module: 'WebsiteContent' },
  { kind: 'operations', tab: 'schedule', label: 'Schedule', icon: '◷', group: 'Operations', module: 'MassSchedule' },
  { kind: 'events', tab: 'mass-schedule', label: 'Mass Schedule', icon: '☩', group: 'Operations', module: 'MassSchedule' },
  { kind: 'operations', tab: 'intentions', label: 'Mass Intentions', icon: '✦', group: 'Operations', module: 'MassSchedule', roles: ['Admin', 'ParishPriest', 'Secretary', 'Staff'] },
  { kind: 'events', tab: 'service-requests', label: 'Service Requests', icon: '✉', group: 'Operations', module: 'ServiceRequest' },
  { kind: 'operations', tab: 'availability', label: 'Booking Availability', icon: '⊘', group: 'Operations', module: 'ServiceRequest' },
  { kind: 'certificates', label: 'Certificate Appointments', icon: '▣', group: 'Records', module: 'ServiceRequest' },
  { kind: 'events', tab: 'sacramental-ledger', label: 'Sacramental Ledger', icon: '✟', group: 'Records', module: 'SacramentalRecords' },
  { kind: 'operations', tab: 'finance', label: 'Finance & Reports', icon: '¤', group: 'Records', module: 'Finance' },
  { kind: 'operations', tab: 'stats', label: 'Stats & Demographics', icon: '⌁', group: 'Records', module: 'SacramentalRecords' },
  { kind: 'operations', tab: 'service-fields', label: 'Booking Form Fields', icon: '✎', group: 'Records', module: 'ServiceRequest', roles: ['Admin', 'ParishPriest', 'Secretary'] },
  { kind: 'events', tab: 'prayers', label: 'Prayer Requests', icon: '♡', group: 'Pastoral', module: 'PrayerRequest' },
  { kind: 'users', label: 'Staff & Roles', icon: '♙', group: 'Administration', module: 'UserManagement' },
  { kind: 'profile', label: 'My Profile', icon: '☺', group: 'Account' },
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
  const [authenticated, setAuthenticated] = useState(false)
  const [tokenRole] = useState(() => staffRoleFromToken(window.localStorage.getItem('adminToken') || ''))
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const staffRole = profile ? normalizeRoleName(profile.role) : tokenRole
  const overrides = profile?.overrides
  const hasOverride = (module?: ModuleName) => Boolean(module && staffRole !== 'Admin' && overrides?.[module])

  // Reset collapsed state when entering mobile breakpoint — the drawer is always full-width
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarCollapsed(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const refreshRole = useCallback(() => {
    const token = window.localStorage.getItem('adminToken') || ''
    if (!token) return
    fetch(`${API_URL}/api/admin/verify`, { headers: { 'x-admin-token': token } })
      .then(response => response.ok ? response.json() : null)
      .then(body => { if (body?.user?.role) setProfile({ ...body.user, overrides: body.user.overrides || {} }) })
      .catch(() => undefined)
  }, [])

  useEffect(() => { if (authenticated) refreshRole() }, [authenticated, refreshRole])
  const allowedSections = sections.filter(section =>
    (!section.module || effectiveModuleAccess(staffRole ? [staffRole] : [], section.module, overrides).view) &&
    (hasOverride(section.module) || !section.roles || section.roles.includes(staffRole)),
  )
  const visibleSection = allowedSections.includes(activeSection) ? activeSection : allowedSections[0]
  const visibleSectionKey = 'tab' in visibleSection
    ? `${visibleSection.kind}-${visibleSection.tab}`
    : 'page' in visibleSection
      ? `${visibleSection.kind}-${visibleSection.page}`
      : visibleSection.kind

  const navigate = (section: AdminSection) => {
    setActiveSection(section)
    setMobileOpen(false)
  }

  if (!authenticated) {
    return <AdminEventsPage initialTab="dashboard" onAuthenticated={setAuthenticated} />
  }

  if (!profile) return <section className="unified-admin"><main className="admin-workspace"><p>Loading your workspace...</p></main></section>

  if (profile.mustChangePassword) {
    return (
      <section className="unified-admin">
        <main className="admin-workspace" style={{ maxWidth: 480, margin: '3rem auto' }}>
          <h1>Change your password</h1>
          <p>Your account is using a temporary password. Choose a new password to continue.</p>
          <ChangePasswordForm onChanged={refreshRole} />
        </main>
      </section>
    )
  }

  return (
    <section className={`unified-admin ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="admin-mobile-toggle btn btn-light shadow-sm" type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle admin navigation" aria-expanded={mobileOpen}>
        <span />
        <span />
        <span />
      </button>
      {/* Tap-outside backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="admin-mobile-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}
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
            <span className="admin-sidebar-collapse-icon" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Admin navigation" className="admin-sidebar-nav nav flex-column gap-1">
          {allowedSections.map((section, index) => (
            <div key={`${section.kind}-${'tab' in section ? section.tab : 'page' in section ? section.page : section.kind}`}>
              {(index === 0 || allowedSections[index - 1].group !== section.group) && <p className="admin-nav-label">{section.group}</p>}
              <button className={`btn text-start ${visibleSection === section ? 'active' : ''}`} type="button" onClick={() => navigate(section)}>
                <span className="admin-nav-icon" aria-hidden="true">{section.icon}</span>
                <span className="admin-nav-text">{section.label}</span>
              </button>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <small>Saint John Parish{staffRole ? ` · ${staffRole}` : ''}</small>
          <button
            className="admin-sidebar-signout-btn"
            type="button"
            onClick={() => { window.localStorage.removeItem('adminToken'); window.location.reload() }}
            title="Sign out"
          >
            <span className="admin-nav-icon" aria-hidden="true">⎋</span>
            <span className="admin-nav-text">Sign out</span>
          </button>
        </div>
      </aside>
      <main className="admin-workspace">
        <div key={`heading-${visibleSectionKey}`} className="admin-workspace-heading d-flex align-items-center justify-content-between gap-3">
          <div><p className="eyebrow">Staff workspace</p><h1>{visibleSection.label}</h1></div>
        </div>
        <div
          key={visibleSectionKey}
          className="admin-section-content"
        >
          {visibleSection.kind === 'events'
            ? <AdminEventsPage key={`events-${visibleSection.tab}-${staffRole}`} initialTab={visibleSection.tab} embedded overrides={overrides} />
            : visibleSection.kind === 'operations'
              ? <AdminOperationsPage key={`operations-${visibleSection.tab}-${staffRole}`} initialTab={visibleSection.tab} embedded staffRole={staffRole} overrides={overrides} />
              : visibleSection.kind === 'certificates'
                    ? <AdminCertificateRequestsPage />
                  : visibleSection.kind === 'content'
                    ? <SiteContentEditorPage key={`content-${visibleSection.page}`} page={visibleSection.page} />
                    : visibleSection.kind === 'messages'
                      ? <AdminContactMessagesPage canDelete={hasOverride('ContactMessages') ? Boolean(overrides?.ContactMessages?.edit) : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)} />
                      : visibleSection.kind === 'profile'
                        ? <AdminProfilePage key={`profile-${profile.userName}-${profile.email}`} profile={profile} onProfileChanged={refreshRole} />
                        : <AdminUsersPage embedded currentRole={staffRole} onUsersChanged={refreshRole} />}
        </div>
      </main>
    </section>
  )
}
