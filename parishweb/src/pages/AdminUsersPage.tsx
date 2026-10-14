import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL as API_URL } from '../api/client'
import { AdminFeedback } from '../components/AdminFeedback'
import { UserPermissionsModal } from '../components/UserPermissionsModal'
import '../PagesCSS/AdminUsersPage.css'

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

type AccountEdit = { userId: number; field: 'email' | 'password' }

type AdminUsersPageProps = { embedded?: boolean; currentRole?: string; onUsersChanged?: () => void }

export function AdminUsersPage({ embedded = false, currentRole = '', onUsersChanged }: AdminUsersPageProps) {
  const [token] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [users, setUsers] = useState<UserItem[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [newUser, setNewUser] = useState({ userName: '', email: '', password: '', role: 'Staff' })
  const [accountEdit, setAccountEdit] = useState<AccountEdit | null>(null)
  const [accountValue, setAccountValue] = useState('')
  const [permissionsUser, setPermissionsUser] = useState<UserItem | null>(null)
  const canManageAccounts = currentRole === 'Admin'
  const canAssignRoles = ['Admin', 'ParishPriest', 'Secretary'].includes(currentRole)

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
        canManageAccounts
          ? fetch(`${API_URL}/api/admin/audit/user-management?limit=100`, { headers })
          : Promise.resolve(null),
      ])
      const usersBody = await usersResponse.json().catch(() => [])
      const auditBody = auditResponse ? await auditResponse.json().catch(() => []) : []
      if (!usersResponse.ok) throw new Error(usersBody?.message || 'Unable to load staff accounts.')
      if (auditResponse && !auditResponse.ok) throw new Error(auditBody?.message || 'Unable to load audit history.')
      setUsers(usersBody as UserItem[])
      setAudit(auditBody as AuditItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load user management data.')
    } finally {
      setLoading(false)
    }
  }, [canManageAccounts, headers])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const updateUser = async (user: UserItem, changes: Record<string, unknown>, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return false
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
      onUsersChanged?.()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update staff account.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const openAccountEdit = (user: UserItem, field: AccountEdit['field']) => {
    setError('')
    setMessage('')
    setAccountEdit({ userId: user.userId, field })
    setAccountValue(field === 'email' ? user.email : '')
  }

  const saveAccountEdit = async (event: React.FormEvent<HTMLFormElement>, user: UserItem) => {
    event.preventDefault()
    if (!accountEdit || accountEdit.userId !== user.userId) return
    const value = accountValue.trim()
    if (accountEdit.field === 'email' && !value) {
      setError('An email address is required.')
      return
    }
    if (accountEdit.field === 'password' && accountValue.length < 8) {
      setError('The password must be at least eight characters.')
      return
    }
    const updated = await updateUser(user, { [accountEdit.field]: accountEdit.field === 'email' ? value : accountValue })
    if (updated) {
      setAccountEdit(null)
      setAccountValue('')
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

  if (!token) return <section className="users-page container py-5"><p className="alert alert-warning">Admin sign-in is required.</p></section>

  return (
    <section className={`users-page ${embedded ? 'users-page-embedded' : ''}`}>
      {!embedded && <div className="users-heading"><p className="eyebrow">Administration</p><h2>Staff accounts and roles</h2></div>}
      <div className="users-intro">
        <div><p className="section-kicker">Access control</p><h2>Staff accounts</h2><p>{canManageAccounts ? 'Manage staff accounts, roles, and account access.' : 'Assign or revoke operational roles. Admin accounts and account details are managed by Admin users.'}</p></div>
        <button type="button" className="secondary-btn" onClick={() => void loadData()} disabled={loading || saving}>Refresh</button>
      </div>

      <AdminFeedback message={message} error={error} onDismiss={() => { setMessage(''); setError('') }} />

      <div className={`users-grid ${canManageAccounts ? '' : 'users-grid-roles-only'}`}>
        {canManageAccounts && <form className="user-create-panel card border-0 shadow-sm" onSubmit={createUser}>
          <h3>Create staff account</h3>
          <label>Username<input className="form-control" required maxLength={256} value={newUser.userName} onChange={event => setNewUser({ ...newUser, userName: event.target.value })} /></label>
          <label>Email<input className="form-control" required type="email" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} /></label>
          <label>Temporary password<input className="form-control" minLength={8} type="password" placeholder="Leave blank to use the default password" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} /></label>
          <small className="account-form-hint">The user must change this password the first time they sign in.</small>
          <label>Initial role<select className="form-select" value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value })}>{ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
          <button type="submit" className="primary-btn btn btn-dark" disabled={saving}>Create account</button>
        </form>}

        <div className="user-list-panel card border-0 shadow-sm">
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
            {loading ? <p className="directory-message">Loading staff accounts...</p> : users.length === 0 ? <p className="directory-message">No staff accounts found.</p> : visibleUsers.length === 0 ? <p className="empty-filter-message">No staff accounts have the {roleFilter} role.</p> : visibleUsers.map(user => (
              <article className="user-card" key={user.userId}>
                <div className="user-card-heading">
                  <div className="user-identity">
                    <span className="user-avatar" aria-hidden="true">{user.userName.slice(0, 2).toUpperCase()}</span>
                    <div className="user-identity-copy"><strong>{user.userName}</strong>{user.email && <small>{user.email}</small>}</div>
                  </div>
                  {canManageAccounts && <button type="button" className="danger-btn" onClick={() => void deleteUser(user)} disabled={saving}>Delete</button>}
                </div>
                <p className="role-options-label">Assigned roles</p>
                <div className="role-options">
                  {(canManageAccounts ? ROLES : ROLES.filter(role => role !== 'Admin')).map(role => {
                    const checked = user.roles.includes(role)
                    return <label key={role}><input type="checkbox" checked={checked} onChange={() => updateUser(user, { roles: checked ? user.roles.filter(item => item !== role) : [...user.roles, role] }, `${checked ? 'Revoke' : 'Assign'} the ${role} role ${checked ? 'from' : 'to'} ${user.userName}?`)} disabled={!canAssignRoles || saving || (user.roles.includes('Admin') && !canManageAccounts) || (checked && user.roles.length === 1)} />{role}</label>
                  })}
                  {!canManageAccounts && user.roles.includes('Admin') && <span className="account-form-hint">Admin role changes are restricted to Admin users.</span>}
                </div>
                <div className="user-card-actions">
                  {canManageAccounts && <>
                    <button type="button" className="secondary-btn" onClick={() => openAccountEdit(user, 'email')} disabled={saving}>Change email</button>
                    <button type="button" className="secondary-btn" onClick={() => openAccountEdit(user, 'password')} disabled={saving}>Reset password</button>
                    <button type="button" className="secondary-btn" onClick={() => void updateUser(user, { resetToDefault: true }, `Reset ${user.userName}'s password to the default password? They must change it at next sign-in.`)} disabled={saving}>Reset to default</button>
                  </>}
                  {canManageAccounts && <button type="button" className="secondary-btn" onClick={() => setPermissionsUser(user)} disabled={saving}>View permissions</button>}
                </div>
                {canManageAccounts && accountEdit?.userId === user.userId && (
                  <form className="user-card-account-form" onSubmit={event => void saveAccountEdit(event, user)}>
                    <label>
                      {accountEdit.field === 'email' ? 'New email address' : 'New password'}
                      <input
                        className="form-control"
                        type={accountEdit.field === 'email' ? 'email' : 'password'}
                        value={accountValue}
                        onChange={event => setAccountValue(event.target.value)}
                        required
                        minLength={accountEdit.field === 'password' ? 8 : undefined}
                        autoComplete={accountEdit.field === 'password' ? 'new-password' : 'email'}
                        autoFocus
                      />
                    </label>
                    {accountEdit.field === 'password' && <small className="account-form-hint">Use at least 8 characters.</small>}
                    <div className="user-card-actions">
                      <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : accountEdit.field === 'email' ? 'Save email' : 'Set new password'}</button>
                      <button type="button" className="secondary-btn" onClick={() => { setAccountEdit(null); setAccountValue(''); setError('') }} disabled={saving}>Cancel</button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>

      {canManageAccounts && <div className="audit-panel">
        <div className="users-intro"><div><p className="section-kicker">Accountability</p><h2>Role and account audit history</h2></div><span>{audit.length} entries</span></div>
        {audit.length === 0 ? <p>No user-management changes recorded yet.</p> : <div className="audit-table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Changed by</th><th>Details</th></tr></thead><tbody>{audit.map(item => {
          const actionLower = item.ActionName.toLowerCase()
          const isDelete = actionLower.includes('delete') || actionLower.includes('remove')
          const isUpdate = actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('change')
          const rowClass = isDelete ? 'audit-row-delete' : isUpdate ? 'audit-row-update' : ''
          return <tr key={item.AuditId} className={rowClass}><td>{new Date(item.ChangedAt).toLocaleString()}</td><td><strong>{item.ActionName.replaceAll('_', ' ')}</strong></td><td>{item.TargetUserName || 'Unknown'}</td><td>{item.ChangedBy}</td><td>{item.Details || '—'}</td></tr>
        })}</tbody></table></div>}
      </div>}
      {permissionsUser && <UserPermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} onSaved={text => { setPermissionsUser(null); setMessage(text); onUsersChanged?.() }} />}
    </section>
  )
}
