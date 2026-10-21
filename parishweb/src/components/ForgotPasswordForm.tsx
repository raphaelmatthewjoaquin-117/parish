import { useState } from 'react'
import { API_BASE_URL as API_URL } from '../api/client'

type ForgotPasswordFormProps = { onBack: () => void }

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to request a password reset.')
      setMessage(body.message || 'If a staff account matches that email, password reset instructions will be sent if email delivery is available.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request a password reset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={event => void submit(event)} className="admin-login-form">
      <label>
        Email address
        <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
      </label>
      {message && <p role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'Requesting...' : 'Request password reset'}</button>
      <button type="button" onClick={onBack} disabled={submitting}>Back to sign in</button>
    </form>
  )
}
