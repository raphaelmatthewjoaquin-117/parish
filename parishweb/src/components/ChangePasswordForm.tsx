import { useState } from 'react'
import { API_BASE_URL as API_URL } from '../api/client'

type ChangePasswordFormProps = { onChanged: () => void; onCancel?: () => void }

export function ChangePasswordForm({ onChanged, onCancel }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) return setError('The new password must be at least eight characters.')
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.')
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/admin/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': window.localStorage.getItem('adminToken') || '' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to change password.')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="d-grid gap-3" onSubmit={event => void submit(event)}>
      {error && <p className="alert alert-danger mb-0" role="alert">{error}</p>}
      <div>
        <label htmlFor="current-password">Current password</label>
        <div className="input-group">
          <input id="current-password" className="form-control" type={showCurrentPassword ? 'text' : 'password'} required autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
          <button className="btn btn-outline-secondary" type="button" aria-label={`${showCurrentPassword ? 'Hide' : 'Show'} current password`} onClick={() => setShowCurrentPassword(!showCurrentPassword)}>{showCurrentPassword ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <div>
        <label htmlFor="new-password">New password</label>
        <div className="input-group">
          <input id="new-password" className="form-control" type={showNewPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
          <button className="btn btn-outline-secondary" type="button" aria-label={`${showNewPassword ? 'Hide' : 'Show'} new password`} onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <div>
        <label htmlFor="confirm-new-password">Confirm new password</label>
        <div className="input-group">
          <input id="confirm-new-password" className="form-control" type={showConfirmPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
          <button className="btn btn-outline-secondary" type="button" aria-label={`${showConfirmPassword ? 'Hide' : 'Show'} confirm new password`} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <div className="d-flex gap-2">
        <button className="btn btn-dark" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Change password'}</button>
        {onCancel && <button className="btn btn-outline-secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </form>
  )
}
