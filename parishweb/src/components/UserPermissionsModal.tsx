import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL as API_URL } from '../api/client'
import { PERMISSION_MODULES, roleModuleAccess, type ModuleAccess, type ModuleName, type ModuleOverrides } from '../utils/rbac'

type UserPermissionsModalProps = {
  user: { userId: number; userName: string; roles: string[] }
  onClose: () => void
  onSaved: (message: string) => void
}

type Matrix = Record<string, ModuleAccess>

const sameAccess = (a: ModuleAccess, b: ModuleAccess) => a.view === b.view && a.edit === b.edit

export function UserPermissionsModal({ user, onClose, onSaved }: UserPermissionsModalProps) {
  const isAdmin = user.roles.includes('Admin')
  const defaults = Object.fromEntries(PERMISSION_MODULES.map(({ module }) => [module, roleModuleAccess(user.roles, module)])) as Matrix
  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', 'x-admin-token': window.localStorage.getItem('adminToken') || '' }

  useEffect(() => {
    let active = true
    fetch(`${API_URL}/api/admin/users/${user.userId}/permissions`, { headers })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'Unable to load permissions.')
        const overrides = (body.overrides || {}) as ModuleOverrides
        if (active) setMatrix(Object.fromEntries(PERMISSION_MODULES.map(({ module }) => [module, overrides[module] ?? defaults[module]])))
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load permissions.') })
    return () => { active = false }
    // The defaults are derived from the user's roles, which do not change while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.userId])

  const setAccess = (module: string, field: 'view' | 'edit', checked: boolean) => {
    setMatrix(current => {
      if (!current) return current
      const next = { ...current[module], [field]: checked }
      if (field === 'edit' && checked) next.view = true
      if (field === 'view' && !checked) next.edit = false
      return { ...current, [module]: next }
    })
  }

  const save = async () => {
    if (!matrix) return
    const overrides: Partial<Record<ModuleName, ModuleAccess>> = {}
    for (const { module } of PERMISSION_MODULES) {
      if (!sameAccess(matrix[module], defaults[module])) overrides[module] = matrix[module]
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${user.userId}/permissions`, {
        method: 'PUT', headers, body: JSON.stringify({ overrides }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to update permissions.')
      onSaved(`✓ Permissions for "${user.userName}" have been updated.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update permissions.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal d-block" role="dialog" aria-modal="true" aria-label={`Permissions for ${user.userName}`} style={{ background: 'rgba(0,0,0,.45)' }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h2 className="modal-title h5">Permissions · {user.userName}</h2>
              <small className="text-muted">Role defaults: {user.roles.join(', ') || 'none'}. Changes below apply to this account only.</small>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error && <p className="alert alert-danger" role="alert">{error}</p>}
            {isAdmin ? <p>Admin accounts always have full access to every module.</p> : !matrix ? (error ? null : <p>Loading permissions...</p>) : (
              <table className="table align-middle mb-0">
                <thead><tr><th>Module</th><th className="text-center">View</th><th className="text-center">Edit</th></tr></thead>
                <tbody>
                  {PERMISSION_MODULES.map(({ module, label }) => (
                    <tr key={module}>
                      <td>{label}{!sameAccess(matrix[module], defaults[module]) && <span className="badge text-bg-warning ms-2">Custom</span>}</td>
                      <td className="text-center"><input type="checkbox" aria-label={`${label} view`} checked={matrix[module].view} onChange={event => setAccess(module, 'view', event.target.checked)} disabled={saving} /></td>
                      <td className="text-center"><input type="checkbox" aria-label={`${label} edit`} checked={matrix[module].edit} onChange={event => setAccess(module, 'edit', event.target.checked)} disabled={saving} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-footer">
            {!isAdmin && matrix && <button type="button" className="btn btn-outline-secondary me-auto" onClick={() => setMatrix(defaults)} disabled={saving}>Reset to role default</button>}
            <button type="button" className="btn btn-light" onClick={onClose} disabled={saving}>Close</button>
            {!isAdmin && matrix && <button type="button" className="btn btn-dark" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save permissions'}</button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
