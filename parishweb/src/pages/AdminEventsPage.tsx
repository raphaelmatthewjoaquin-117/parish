import React, { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

type EventItem = {
  id: string
  title: string
  detail: string
  date: string
  time?: string
  location?: string
}

type EventForm = {
  title: string
  detail: string
  date: string
  time: string
  location: string
}

const initialForm: EventForm = {
  title: '',
  detail: '',
  date: '',
  time: '',
  location: '',
}

export function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<EventForm>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminToken, setAdminToken] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('adminToken') ?? ''
  })
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginToken, setLoginToken] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  const adminHeaders = {
    'Content-Type': 'application/json',
    ...(adminToken ? { 'x-admin-token': adminToken } : {}),
  }

  const verifyAdmin = () => {
    if (!adminToken) {
      setAuthLoading(false)
      setAuthenticated(false)
      return
    }

    setAuthError(null)
    setAuthLoading(true)

    fetch(`${API_URL}/api/admin/verify`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Invalid admin token')
        }
        setAuthenticated(true)
      })
      .catch(() => {
        setAuthenticated(false)
        setAuthError('Invalid stored admin token. Please log in again.')
      })
      .finally(() => setAuthLoading(false))
  }

  useEffect(() => {
    verifyAdmin()
  }, [])

  const loadEvents = () => {
    setLoading(true)
    setError(null)

    fetch(`${API_URL}/api/events`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to load events')
        }
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid events response')
        }
        setEvents(data as EventItem[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load events')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authenticated) {
      loadEvents()
    }
  }, [authenticated])

  const saveAdminToken = (token: string) => {
    setAdminToken(token)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('adminToken', token)
    }
  }

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError(null)

    fetch(`${API_URL}/api/admin/verify`, {
      headers: { 'x-admin-token': loginToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Invalid admin token')
        }
        saveAdminToken(loginToken)
        setAuthenticated(true)
      })
      .catch(() => {
        setAuthError('Invalid admin token. Please try again.')
        setAuthenticated(false)
      })
      .finally(() => setAuthLoading(false))
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
    setError(null)
  }

  const startEdit = (event: EventItem) => {
    setEditingId(event.id)
    setForm({
      title: event.title,
      detail: event.detail,
      date: event.date,
      time: event.time ?? '',
      location: event.location ?? '',
    })
    setError(null)
  }

  const deleteEvent = (id: string) => {
    if (!window.confirm('Delete this event?')) return
    setSaving(true)
    setError(null)
    fetch(`${API_URL}/api/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to delete event')
        }
        loadEvents()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to delete event')
      })
      .finally(() => setSaving(false))
  }

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const url = editingId ? `${API_URL}/api/events/${encodeURIComponent(editingId)}` : `${API_URL}/api/events`
    const method = editingId ? 'PUT' : 'POST'

    fetch(url, {
      method,
      headers: adminHeaders,
      body: JSON.stringify(form),
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(body => { throw new Error(body?.message || 'Unable to save event') })
        }
        return response.json()
      })
      .then(() => {
        resetForm()
        loadEvents()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to save event')
      })
      .finally(() => setSaving(false))
  }

  if (authLoading) {
    return (
      <section className="content-section simple-page">
        <p>Checking admin access…</p>
      </section>
    )
  }

  if (!authenticated) {
    return (
      <section className="content-section simple-page">
        <div className="section-heading">
          <p className="eyebrow">Admin login required</p>
          <h2>Staff event management</h2>
        </div>
        <form onSubmit={handleLogin} className="admin-login-form">
          <label>
            Admin token
            <input
              type="password"
              value={loginToken}
              onChange={e => setLoginToken(e.target.value)}
              required
            />
          </label>
          {authError && <p className="error-message">{authError}</p>}
          <button type="submit" disabled={authLoading}>
            Sign in
          </button>
        </form>
        <p>Access via <code>/admin/events</code>. Staff use the admin token configured in the backend.</p>
      </section>
    )
  }

  return (
    <section className="content-section simple-page">
      <div className="section-heading">
        <p className="eyebrow">Event Administration</p>
        <h2>Manage calendar events</h2>
      </div>

      <div className="admin-panel">
        <div className="admin-form">
          <h3>{editingId ? 'Edit event' : 'Add new event'}</h3>
          <form onSubmit={submitForm}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>
            <label>
              Detail
              <textarea
                value={form.detail}
                onChange={e => setForm({ ...form, detail: e.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
              />
            </label>
            <label>
              Location
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </label>
            {error && <p className="error-message">{error}</p>}
            <div className="button-row">
              <button type="submit" disabled={saving}>
                {editingId ? 'Save changes' : 'Add event'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="admin-list">
          <h3>Existing events</h3>
          {loading && <p>Loading events…</p>}
          {!loading && events.length === 0 && <p>No events found.</p>}
          <ul>
            {events.map(event => (
              <li key={event.id} className="admin-event-row">
                <div>
                  <strong>{event.title}</strong>
                  <div>{new Date(event.date).toLocaleDateString()}</div>
                  {event.location && <div>{event.location}</div>}
                </div>
                <div className="admin-buttons">
                  <button type="button" onClick={() => startEdit(event)} disabled={saving}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteEvent(event.id)} disabled={saving}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
