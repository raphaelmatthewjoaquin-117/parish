import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { API_BASE_URL as API_URL, apiClient, useApiError as formatApiError } from '../api/client'
import '../PagesCSS/AdminOperationsPage.css'

type BlockedSlot = { id: number; date: string; time: string | null; scope: 'All' | 'Service' | 'Certificate'; serviceId: number | null; serviceName: string | null; reason: string | null }
type ServiceOption = { id: number; name: string }

const timeOptions = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']

export function AdminBookingAvailabilityPage({ canEdit = true }: { canEdit?: boolean }) {
  const [token] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [items, setItems] = useState<BlockedSlot[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [scope, setScope] = useState<'All' | 'Service' | 'Certificate'>('All')
  const [serviceId, setServiceId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    try { setItems(await apiClient.admin.blockedSlots(token)) } catch (reason) { setError(formatApiError(reason)) }
  }, [token])

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [token, load])

  useEffect(() => {
    fetch(`${API_URL}/api/services`)
      .then(response => response.ok ? response.json() : [])
      .then((data: unknown) => {
        if (!Array.isArray(data)) return
        setServices(data
          .map((row: Record<string, unknown>) => ({ id: Number(row.id ?? row.serviceId), name: String(row.name ?? '') }))
          .filter(service => service.id > 0 && service.name))
      })
      .catch(() => undefined)
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(''); setMessage('')
    try {
      await apiClient.admin.createBlockedSlot({ date, time: time || null, scope, serviceId: scope === 'Service' ? Number(serviceId) : null, reason }, token)
      setMessage('Date blocked. Clients can no longer book it.')
      setDate(''); setTime(''); setReason('')
      await load()
    } catch (reason) { setError(formatApiError(reason)) }
  }

  const remove = async (id: number) => {
    setError(''); setMessage('')
    try { await apiClient.admin.deleteBlockedSlot(id, token); setMessage('Slot is available for booking again.'); await load() } catch (reason) { setError(formatApiError(reason)) }
  }

  const scopeLabel = (item: BlockedSlot) => item.scope === 'All' ? 'All services and certificates' : item.scope === 'Certificate' ? 'Certificate appointments' : item.serviceName || `Service #${item.serviceId}`

  if (!token) return <section className="operations-page container py-5"><p className="alert alert-warning">Staff sign-in is required.</p></section>

  return <section className="operations-page admin-embedded-page container-fluid py-4">
    {message && <p className="success-message alert alert-success">{message}</p>}
    {error && <p className="error-message alert alert-danger">{error}</p>}
    {canEdit && <form className="card border-0 shadow-sm p-3 mb-4 row g-3" onSubmit={event => void submit(event)}>
      <div className="col-md-3"><label className="form-label" htmlFor="block-date">Date</label><input id="block-date" className="form-control" type="date" required min={today} value={date} onChange={event => setDate(event.target.value)} /></div>
      <div className="col-md-3"><label className="form-label" htmlFor="block-time">Time</label><select id="block-time" className="form-select" value={time} onChange={event => setTime(event.target.value)}><option value="">Whole day</option>{timeOptions.map(option => <option key={option}>{option}</option>)}</select></div>
      <div className="col-md-3"><label className="form-label" htmlFor="block-scope">Applies to</label><select id="block-scope" className="form-select" value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="All">All services and certificates</option><option value="Certificate">Certificate appointments</option><option value="Service">A specific service</option></select></div>
      {scope === 'Service' && <div className="col-md-3"><label className="form-label" htmlFor="block-service">Service</label><select id="block-service" className="form-select" required value={serviceId} onChange={event => setServiceId(event.target.value)}><option value="">Select a service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div>}
      <div className="col-md-9"><label className="form-label" htmlFor="block-reason">Reason (shown to clients)</label><input id="block-reason" className="form-control" maxLength={300} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Parish retreat" /></div>
      <div className="col-md-3 d-flex align-items-end"><button className="btn btn-dark w-100" type="submit">Block</button></div>
    </form>}
    <div className="operations-list row g-3">
      {items.length === 0 ? <p>No upcoming blocked dates or times.</p> : items.map(item => <article className="col-12" key={item.id}><div className="card border-0 shadow-sm p-3 d-flex flex-row justify-content-between align-items-center gap-3 flex-wrap">
        <div><strong>{item.date} · {item.time || 'Whole day'}</strong><span className="d-block">{scopeLabel(item)}</span>{item.reason && <small className="d-block">{item.reason}</small>}</div>
        {canEdit && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => void remove(item.id)}>Unblock</button>}
      </div></article>)}
    </div>
  </section>
}
