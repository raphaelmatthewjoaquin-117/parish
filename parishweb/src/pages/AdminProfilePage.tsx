import { useState } from 'react'
import { API_BASE_URL as API_URL } from '../api/client'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { PERMISSION_MODULES, effectiveModuleAccess, type ModuleOverrides } from '../utils/rbac'

export type StaffProfile = {
  id: number
  role: string
  userName: string
  email: string
  mustChangePassword: boolean
  overrides: ModuleOverrides
}

type AdminProfilePageProps = { profile: StaffProfile; onProfileChanged: () => void }

export function AdminProfilePage({ profile, onProfileChanged }: AdminProfilePageProps) {
  const [userName, setUserName] = useState(profile.userName)
  const [email, setEmail] = useState(profile.email)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/admin/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': window.localStorage.getItem('adminToken') || '' },
        body: JSON.stringify({ userName, email }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to update profile.')
      setMessage('Profile updated.')
      onProfileChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <form className="card border-0 shadow-sm p-4 d-grid gap-3" onSubmit={event => void saveProfile(event)}>
          <h3 className="h5 mb-0">My profile</h3>
          {error && <p className="alert alert-danger mb-0" role="alert">{error}</p>}
          {message && <p className="alert alert-success mb-0" role="status">{message}</p>}
          <label>Username<input className="form-control" required maxLength={256} value={userName} onChange={event => setUserName(event.target.value)} /></label>
          <label>Email<input className="form-control" required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>Role<input className="form-control" value={profile.role} readOnly disabled /></label>
          <div><button className="btn btn-dark" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button></div>
        </form>
      </div>
      <div className="col-lg-6 d-grid gap-4 align-content-start">
        <div className="card border-0 shadow-sm p-4">
          <h3 className="h5">Password</h3>
          {showPassword
            ? <ChangePasswordForm onChanged={() => { setShowPassword(false); setMessage('Password changed.') }} onCancel={() => setShowPassword(false)} />
            : <div><button className="btn btn-outline-dark" type="button" onClick={() => setShowPassword(true)}>Change password</button></div>}
        </div>
        <div className="card border-0 shadow-sm p-4">
          <h3 className="h5">My access</h3>
          <table className="table table-sm mb-0">
            <thead><tr><th>Module</th><th>View</th><th>Edit</th></tr></thead>
            <tbody>
              {PERMISSION_MODULES.map(({ module, label }) => {
                const access = effectiveModuleAccess([profile.role], module, profile.overrides)
                return <tr key={module}><td>{label}</td><td>{access.view ? '✓' : '—'}</td><td>{access.edit ? '✓' : '—'}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
