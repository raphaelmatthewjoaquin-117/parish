import { useCallback, useEffect, useMemo, useState } from 'react'
import '../PagesCSS/AdminUsersPage.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const ROLES = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'] as const

type UserItem = {
  userId: number
  userName: string
  email: string
  emailConfirmed: boolean
  lockoutEnabled: boolean
  accessFailedCount: number
  roles: string[]
}

type AuditItem = {
  AuditId: number
  ActionName: string
  TargetUserId: number | null
  TargetUserName: string | null
  ChangedBy: string
  ChangedAt: string
  Details?: string | null
}

type AdminUsersPageProps = { embedded?: boolean }

export function AdminUsersPage({ embedded = false }: AdminUsersPageProps) {
  const [token] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [users, setUsers] = useState<UserItem[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [newUser, setNewUser] = useState({ userName: '', email: '', password: '', role: 'Staff' })
  const [override, setOverride] = useState({ targetUserName: '', reason: '', durationMinutes: '15' })
  const [overrideToken, setOverrideToken] = useState('')

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', 'x-admin-token': token }), [token])
  const visibleUsers = useMemo(
    () => roleFilter === 'All roles' ? users : users.filter(user => user.roles.includes(roleFilter)),
    [roleFilter, users],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [usersResponse, auditResponse] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers }),
        fetch(`${API_URL}/api/admin/audit/user-management?limit=100`, { headers }),
      ])
      const usersBody = await usersResponse.json().catch(() => [])
      const auditBody = await auditResponse.json().catch(() => [])
      if (!usersResponse.ok) throw new Error(usersBody?.message || 'Unable to load staff accounts.')
      if (!auditResponse.ok) throw new Error(auditBody?.message || 'Unable to load audit history.')
      setUsers(usersBody as UserItem[])
      setAudit(auditBody as AuditItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load user management data.')
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const updateUser = async (user: UserItem, changes: Record<string, unknown>, confirmation: string) => {
    if (!window.confirm(confirmation)) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${user.userId}`, {
        method: 'PUT', headers, body: JSON.stringify(changes),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to update staff account.')
      setMessage(`✓ User "${user.userName}" has been updated successfully.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update staff account.')
    } finally {
      setSaving(false)
    }
  }

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!window.confirm(`Create staff account for ${newUser.userName} with the ${newUser.role} role?`)) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...newUser, roles: [newUser.role] }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to create staff account.')
      setNewUser({ userName: '', email: '', password: '', role: 'Staff' })
      setMessage(`✓ User "${newUser.userName}" has been added successfully.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create staff account.')
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (user: UserItem) => {
    if (!window.confirm(`Delete ${user.userName}? This removes the account and its role assignments.`)) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${user.userId}`, { method: 'DELETE', headers })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to delete staff account.')
      setMessage(`✓ User "${user.userName}" has been deleted successfully.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete staff account.')
    } finally {
      setSaving(false)
    }
  }

  const createEmergencyOverride = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!window.confirm(`Grant temporary emergency Admin access to ${override.targetUserName}?`)) return
    setSaving(true)
    setError('')
    setMessage('')
    setOverrideToken('')
    try {
      const response = await fetch(`${API_URL}/api/admin/emergency-override`, {
        method: 'POST', headers, body: JSON.stringify({ ...override, durationMinutes: Number(override.durationMinutes) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to create emergency override.')
      setOverrideToken(body.token || '')
      setMessage(`Emergency override expires at ${new Date(body.expiresAt).toLocaleString()}.`)
      setOverride({ targetUserName: '', reason: '', durationMinutes: '15' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create emergency override.')
    } finally {
      setSaving(false)
    }
  }

  if (!token) return <section className="users-page container py-5"><p className="alert alert-warning">Admin sign-in is required.</p></section>

  return (
    <section className={`users-page ${embedded ? 'users-page-embedded' : ''}`}>
      {!embedded && <div className="users-heading"><p className="eyebrow">Administration</p><h2>Staff accounts and roles</h2></div>}
      <div className="users-intro">
        <div><p className="section-kicker">Access control</p><h2>Staff accounts</h2><p>Only Admin users can assign roles, revoke access, or delete staff accounts.</p></div>
        <button type="button" className="secondary-btn" onClick={() => void loadData()} disabled={loading || saving}>Refresh</button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <div className="users-grid row g-4">
        <form className="user-create-panel col-lg-4 card border-0 shadow-sm p-4 d-grid gap-3" onSubmit={createUser}>
          <h3>Create staff account</h3>
          <label>Username<input className="form-control" required value={newUser.userName} onChange={event => setNewUser({ ...newUser, userName: event.target.value })} /></label>
          <label>Email<input className="form-control" required type="email" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} /></label>
          <label>Temporary password<input className="form-control" required minLength={8} type="password" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} /></label>
          <label>Initial role<select className="form-select" value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value })}>{ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
          <button type="submit" className="primary-btn btn btn-dark" disabled={saving}>Create account</button>
        </form>

        <form className="user-create-panel col-lg-4 card border-0 shadow-sm p-4 d-grid gap-3" onSubmit={createEmergencyOverride}>
          <h3>Emergency override</h3>
          <p>Grant temporary full access for a documented incident. The action is recorded in the security audit log.</p>
          <label>Target username<input className="form-control" required value={override.targetUserName} onChange={event => setOverride({ ...override, targetUserName: event.target.value })} /></label>
          <label>Reason<textarea className="form-control" required value={override.reason} onChange={event => setOverride({ ...override, reason: event.target.value })} /></label>
          <label>Duration in minutes<input className="form-control" required type="number" min="1" max="60" value={override.durationMinutes} onChange={event => setOverride({ ...override, durationMinutes: event.target.value })} /></label>
          <button type="submit" className="danger-btn btn btn-danger" disabled={saving}>Grant temporary access</button>
          {overrideToken && <small>Override token: {overrideToken}</small>}
        </form>

        <div className="user-list-panel col-lg-4 card border-0 shadow-sm p-4">
          <div className="user-list-heading">
            <div><p className="section-kicker">Directory</p><h3>Current staff</h3></div>
            <span className="user-count">{visibleUsers.length} of {users.length}</span>
          </div>
          <label className="role-filter">Filter by role
            <select className="form-select" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
              <option>All roles</option>
              {ROLES.map(role => <option key={role}>{role}</option>)}
            </select>
          </label>
          <div className="user-list-scrollable">
            {loading ? <p>Loading staff accounts...</p> : users.length === 0 ? <p>No staff accounts found.</p> : visibleUsers.length === 0 ? <p className="empty-filter-message">No staff accounts have the {roleFilter} role.</p> : visibleUsers.map(user => (
              <article className="user-card" key={user.userId}>
                <div className="user-card-heading"><div><strong>{user.userName}</strong><small>{user.email}</small></div><button type="button" className="danger-btn" onClick={() => void deleteUser(user)} disabled={saving}>Delete</button></div>
                <div className="role-options">
                  {ROLES.map(role => {
                    const checked = user.roles.includes(role)
                    return <label key={role}><input type="checkbox" checked={checked} onChange={() => updateUser(user, { roles: checked ? user.roles.filter(item => item !== role) : [...user.roles, role] }, `${checked ? 'Revoke' : 'Assign'} the ${role} role ${checked ? 'from' : 'to'} ${user.userName}?`)} disabled={saving || (checked && user.roles.length === 1)} />{role}</label>
                  })}
                </div>
                <div className="user-card-actions">
                  <button type="button" className="secondary-btn" onClick={() => updateUser(user, { email: window.prompt('Enter the new email address:', user.email) || user.email }, `Update the email address for ${user.userName}?`)} disabled={saving}>Change email</button>
                  <button type="button" className="secondary-btn" onClick={() => updateUser(user, { password: window.prompt('Enter a new password (8+ characters):') || '' }, `Reset the password for ${user.userName}?`)} disabled={saving}>Reset password</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="audit-panel">
        <div className="users-intro"><div><p className="section-kicker">Accountability</p><h2>Role and account audit history</h2></div><span>{audit.length} entries</span></div>
        {audit.length === 0 ? <p>No user-management changes recorded yet.</p> : <div className="audit-table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Changed by</th><th>Details</th></tr></thead><tbody>{audit.map(item => {
          const actionLower = item.ActionName.toLowerCase()
          const isDelete = actionLower.includes('delete') || actionLower.includes('remove')
          const isUpdate = actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('change')
          const rowClass = isDelete ? 'audit-row-delete' : isUpdate ? 'audit-row-update' : ''
          return <tr key={item.AuditId} className={rowClass}><td>{new Date(item.ChangedAt).toLocaleString()}</td><td><strong>{item.ActionName.replaceAll('_', ' ')}</strong></td><td>{item.TargetUserName || 'Unknown'}</td><td>{item.ChangedBy}</td><td>{item.Details || '—'}</td></tr>
        })}</tbody></table></div>}
      </div>
    </section>
  )
}
