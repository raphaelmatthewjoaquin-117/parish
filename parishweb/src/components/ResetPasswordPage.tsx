import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL as API_URL } from '../api/client'

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
    <section className="content-section simple-page admin-login-page">
      <div className="section-heading">
        <p className="eyebrow">Staff account</p>
        <h2>Choose a new password</h2>
      </div>
      {!token ? (
        <>
          <p role="alert">This password reset link is missing or invalid. Request a new one from the admin sign-in page.</p>
          <Link to="/admin">Return to sign in</Link>
        </>
      ) : message ? (
        <>
          <p role="status">{message}</p>
          <Link to="/admin">Sign in</Link>
        </>
      ) : (
        <form onSubmit={event => void submit(event)} className="admin-login-form">
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      )}
    </section>
  )
}
