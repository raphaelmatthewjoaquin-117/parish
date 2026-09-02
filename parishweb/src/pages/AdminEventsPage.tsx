import React, { useEffect, useState } from 'react'
import '../PagesCSS/AdminEventsPage.css'

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

type PrayerItem = {
  id: number
  name: string
  category: string
  request: string
  anonymous: boolean
  shareWithCommunity: boolean
  isApproved: boolean
  createdAt: string
}

type ServiceRequestItem = {
  id: number
  parishionerId: number
  serviceId: number
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  address: string
  serviceName: string
  scheduledDate: string
  scheduledTime: string
  status: string
  notes: string
  createdAt: string
}

const initialForm: EventForm = {
  title: '',
  detail: '',
  date: '',
  time: '',
  location: '',
}

export function AdminEventsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'events' | 'prayers' | 'service-requests'>('events')

  // Event states
  const [events, setEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<EventForm>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Prayer states
  const [prayers, setPrayers] = useState<PrayerItem[]>([])
  const [selectedPrayer, setSelectedPrayer] = useState<PrayerItem | null>(null)
  const [prayersLoading, setPrayersLoading] = useState(false)

  // Service Request states
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestItem[]>([])
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequestItem | null>(null)
  const [serviceRequestsLoading, setServiceRequestsLoading] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  // Common states
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

  // Event functions
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

  // Prayer functions
  const loadPrayers = () => {
    setPrayersLoading(true)
    setError(null)

    fetch(`${API_URL}/api/admin/prayers`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to load prayers')
        }
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid prayers response')
        }
        setPrayers(data as PrayerItem[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load prayers')
      })
      .finally(() => setPrayersLoading(false))
  }

  const approvePrayer = (prayerId: number) => {
    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/prayers/${prayerId}/approve`, {
      method: 'POST',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to approve prayer')
        }
        loadPrayers()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to approve prayer')
      })
      .finally(() => setSaving(false))
  }

  const rejectPrayer = (prayerId: number) => {
    if (!window.confirm('Delete this prayer?')) return
    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/prayers/${prayerId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to delete prayer')
        }
        loadPrayers()
        setSelectedPrayer(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to delete prayer')
      })
      .finally(() => setSaving(false))
  }

  // Service Request functions
  const loadServiceRequests = () => {
    setServiceRequestsLoading(true)
    setError(null)

    fetch(`${API_URL}/api/admin/service-requests`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to load service requests')
        }
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid service requests response')
        }
        setServiceRequests(data as ServiceRequestItem[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load service requests')
      })
      .finally(() => setServiceRequestsLoading(false))
  }

  const confirmServiceRequest = (requestId: number) => {
    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/admin/service-requests/${requestId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'Confirmed', adminNotes: adminNotes || null }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to confirm request')
        }
        loadServiceRequests()
        setSelectedServiceRequest(null)
        setAdminNotes('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to confirm request')
      })
      .finally(() => setSaving(false))
  }

  const deleteServiceRequest = (requestId: number) => {
    if (!window.confirm('Delete this service request? This cannot be undone.')) return

    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/admin/service-requests/${requestId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to delete service request')
        }
        loadServiceRequests()
        setSelectedServiceRequest(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to delete service request')
      })
      .finally(() => setSaving(false))
  }

  useEffect(() => {
    if (authenticated) {
      if (activeTab === 'events') {
        loadEvents()
      } else if (activeTab === 'prayers') {
        loadPrayers()
      } else if (activeTab === 'service-requests') {
        loadServiceRequests()
      }
    }
  }, [authenticated, activeTab])

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
          <h2>Staff administration</h2>
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
        <p className="eyebrow">Administration</p>
        <h2>Manage events, prayer requests, and service bookings</h2>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
        <button
          className={`admin-tab ${activeTab === 'prayers' ? 'active' : ''}`}
          onClick={() => setActiveTab('prayers')}
        >
          Prayer Requests
        </button>
        <button
          className={`admin-tab ${activeTab === 'service-requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('service-requests')}
        >
          Service Requests
        </button>
      </div>

      {activeTab === 'events' && (
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
      )}

      {activeTab === 'prayers' && (
        <div className="admin-panel">
          <div className="admin-prayers-list">
            <h3>Prayer Requests</h3>
            {error && <p className="error-message">{error}</p>}
            {prayersLoading && <p>Loading prayers…</p>}
            {!prayersLoading && prayers.length === 0 && <p>No prayer requests found.</p>}
            {!prayersLoading && prayers.length > 0 && (
              <ul>
                {prayers.map(prayer => (
                  <li
                    key={prayer.id}
                    className={`admin-prayer-row ${prayer.isApproved ? 'approved' : 'pending'}`}
                  >
                    <div className="prayer-info">
                      <div className="prayer-header">
                        <strong>{prayer.anonymous ? 'Anonymous' : prayer.name}</strong>
                        <span className="prayer-category">{prayer.category}</span>
                        {prayer.isApproved && <span className="badge approved-badge">Approved</span>}
                      </div>
                      <div className="prayer-text">{prayer.request.substring(0, 100)}...</div>
                      <div className="prayer-meta">
                        <small>{new Date(prayer.createdAt).toLocaleDateString()}</small>
                        {prayer.shareWithCommunity && <small>• Shared with community</small>}
                      </div>
                    </div>
                    <div className="admin-buttons">
                      <button
                        type="button"
                        onClick={() => setSelectedPrayer(prayer)}
                        className="secondary-btn"
                      >
                        View
                      </button>
                      {!prayer.isApproved && (
                        <button
                          type="button"
                          onClick={() => approvePrayer(prayer.id)}
                          disabled={saving}
                          className="primary-btn"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => rejectPrayer(prayer.id)}
                        disabled={saving}
                        className="danger-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedPrayer && (
            <div className="admin-prayer-detail">
              <div className="detail-header">
                <h3>Prayer Request Detail</h3>
                <button
                  type="button"
                  onClick={() => setSelectedPrayer(null)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>
              <div className="detail-content">
                <div className="detail-row">
                  <label>Name:</label>
                  <span>{selectedPrayer.anonymous ? 'Anonymous' : selectedPrayer.name}</span>
                </div>
                <div className="detail-row">
                  <label>Category:</label>
                  <span>{selectedPrayer.category}</span>
                </div>
                <div className="detail-row">
                  <label>Submitted:</label>
                  <span>{new Date(selectedPrayer.createdAt).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <label>Sharing:</label>
                  <span>{selectedPrayer.shareWithCommunity ? 'Shared with community' : 'Private'}</span>
                </div>
                <div className="detail-row">
                  <label>Status:</label>
                  <span>{selectedPrayer.isApproved ? 'Approved' : 'Pending Approval'}</span>
                </div>
                <div className="detail-request">
                  <label>Request:</label>
                  <p>{selectedPrayer.request}</p>
                </div>
                <div className="detail-actions">
                  {!selectedPrayer.isApproved && (
                    <button
                      type="button"
                      onClick={() => {
                        approvePrayer(selectedPrayer.id)
                        setSelectedPrayer(null)
                      }}
                      disabled={saving}
                      className="primary-btn"
                    >
                      Approve Prayer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      rejectPrayer(selectedPrayer.id)
                      setSelectedPrayer(null)
                    }}
                    disabled={saving}
                    className="danger-btn"
                  >
                    Delete Prayer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'service-requests' && (
        <div className="admin-panel">
          <div className="admin-service-list">
            <div className="service-list-heading">
              <div>
                <p className="section-kicker">Bookings</p>
                <h3>Service Requests</h3>
              </div>
              {!serviceRequestsLoading && <span className="request-count">{serviceRequests.length} total</span>}
            </div>
            {error && <p className="error-message">{error}</p>}
            {serviceRequestsLoading && <p>Loading service requests…</p>}
            {!serviceRequestsLoading && serviceRequests.length === 0 && <p>No service requests found.</p>}
            {!serviceRequestsLoading && serviceRequests.length > 0 && (
              <ul className="service-request-cards">
                {serviceRequests.map(request => (
                  <li
                    key={request.id}
                    className={`admin-service-row status-${request.status.toLowerCase()}`}
                  >
                    <div className="service-info">
                      <div className="service-header">
                        <div>
                          <strong>{request.firstName} {request.lastName}</strong>
                          <span className="service-type">{request.serviceName}</span>
                        </div>
                        <span className={`badge status-badge ${request.status === 'Confirmed' ? 'confirmed' : 'pending'}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="service-details">
                        <small><span aria-hidden="true">📅</span> {new Date(request.scheduledDate).toLocaleDateString()} at {request.scheduledTime}</small>
                        <small><span aria-hidden="true">📧</span> {request.email}</small>
                      </div>
                    </div>
                    <div className="admin-buttons">
                      <button
                        type="button"
                        onClick={() => setSelectedServiceRequest(request)}
                        className="secondary-btn"
                      >
                        View
                      </button>
                      {request.status !== 'Confirmed' && (
                        <button
                          type="button"
                          onClick={() => confirmServiceRequest(request.id)}
                          disabled={saving}
                          className="primary-btn"
                        >
                          Confirm
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteServiceRequest(request.id)}
                        disabled={saving}
                        className="danger-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedServiceRequest && (
            <div className="admin-service-detail">
              <div className="detail-header">
                <h3>Service Request Detail</h3>
                <button
                  type="button"
                  onClick={() => setSelectedServiceRequest(null)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>
              <div className="detail-content">
                <div className="detail-row">
                  <label>Name:</label>
                  <span>{selectedServiceRequest.firstName} {selectedServiceRequest.lastName}</span>
                </div>
                <div className="detail-row">
                  <label>Email:</label>
                  <span>{selectedServiceRequest.email}</span>
                </div>
                <div className="detail-row">
                  <label>Phone:</label>
                  <span>{selectedServiceRequest.mobileNumber}</span>
                </div>
                <div className="detail-row">
                  <label>Address:</label>
                  <span>{selectedServiceRequest.address}</span>
                </div>
                <div className="detail-row">
                  <label>Service:</label>
                  <span>{selectedServiceRequest.serviceName}</span>
                </div>
                <div className="detail-row">
                  <label>Scheduled:</label>
                  <span>{new Date(selectedServiceRequest.scheduledDate).toLocaleDateString()} at {selectedServiceRequest.scheduledTime}</span>
                </div>
                <div className="detail-row">
                  <label>Status:</label>
                  <span>{selectedServiceRequest.status}</span>
                </div>
                {selectedServiceRequest.notes && (
                  <div className="detail-row">
                    <label>Notes:</label>
                    <span>{selectedServiceRequest.notes}</span>
                  </div>
                )}
                <div className="detail-request">
                  <label>Add Admin Notes:</label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this booking..."
                    rows={3}
                  />
                </div>
                <div className="detail-actions">
                  {selectedServiceRequest.status !== 'Confirmed' && (
                    <button
                      type="button"
                      onClick={() => {
                        confirmServiceRequest(selectedServiceRequest.id)
                        setSelectedServiceRequest(null)
                      }}
                      disabled={saving}
                      className="primary-btn"
                    >
                      Confirm Booking
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteServiceRequest(selectedServiceRequest.id)}
                    disabled={saving}
                    className="danger-btn"
                  >
                    Delete Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceRequest(null)}
                    className="secondary-btn"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
