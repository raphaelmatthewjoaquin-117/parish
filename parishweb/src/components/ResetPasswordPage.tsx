import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL as API_URL } from '../api/client'
import './ResetPasswordPage.css'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => searchParams.get('token') || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (token && location.search) {
      navigate(location.pathname, { replace: true })
    }
  }, [location.pathname, location.search, navigate, token])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/api/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to reset the password.')
      setMessage(body.message || 'Your password has been reset. You can now sign in.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset the password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="password-reset-page" aria-labelledby="password-reset-title">
      <div className="password-reset-card">
        <div className="password-reset-heading">
          <p className="eyebrow">Staff account</p>
          <h1 id="password-reset-title">Choose a new password</h1>
          <p>Choose a secure password with at least 8 characters.</p>
        </div>
        {!token ? (
          <div className="password-reset-feedback" role="alert">
            <p>This password reset link is missing or invalid. Request a new one from the admin sign-in page.</p>
            <Link to="/admin">Return to sign in</Link>
          </div>
        ) : message ? (
          <div className="password-reset-feedback password-reset-feedback--success" role="status">
            <p>{message}</p>
            <Link to="/admin">Sign in</Link>
          </div>
        ) : (
          <form onSubmit={event => void submit(event)} className="password-reset-form" aria-labelledby="password-reset-title">
            <label htmlFor="reset-new-password">
              New password
              <input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            <label htmlFor="reset-confirm-password">
              Confirm new password
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            {error && <p className="password-reset-error" role="alert">{error}</p>}
            <button className="password-reset-submit" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
