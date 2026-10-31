import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import { officeHourSlotTimes } from '../../server-rules.js'
import { apiClient, useApiError as formatApiError } from '../api/client'
import { AdminFeedback } from '../components/AdminFeedback'
import '../PagesCSS/AdminOperationsPage.css'

type BlockedSlot = { id: number; date: string; time: string | null; scope: 'All' | 'Service' | 'Certificate'; serviceId: number | null; serviceName: string | null; reason: string | null }
type ServiceOption = { id: number; name: string }

const dateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

export function AdminBookingAvailabilityPage({ canEdit = true }: { canEdit?: boolean }) {
  const [token] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [items, setItems] = useState<BlockedSlot[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [time, setTime] = useState('')
  const [scope, setScope] = useState<'All' | 'Service' | 'Certificate'>('All')
  const [serviceId, setServiceId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const today = dateKey(new Date())
  const selectedTimes = officeHourSlotTimes(selectedDate)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await apiClient.admin.blockedSlots(token))
      setError('')
    } catch (reason) {
      setError(formatApiError(reason))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [token, load])

  useEffect(() => {
    if (scope !== 'Service') return
    apiClient.services.list()
      .then(data => {
        setServices(data
          .map((row: Record<string, unknown>) => ({ id: Number(row.id ?? row.serviceId), name: String(row.name ?? '') }))
          .filter(service => service.id > 0 && service.name))
      })
      .catch(reason => setError(formatApiError(reason)))
  }, [scope])

  const events = useMemo(() => items.map(item => ({
    id: String(item.id),
    title: item.time ? `Blocked · ${item.time}` : 'Blocked all day',
    start: item.date,
    allDay: true,
    classNames: ['availability-calendar-event'],
  })), [items])

  const handleDateClick = ({ dateStr }: DateClickArg) => {
    if (!canEdit || dateStr < today || officeHourSlotTimes(dateStr).length === 0) return
    setSelectedDate(dateStr)
    setTime('')
    setMessage('')
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!selectedDate) {
      setError('Select an office date on the calendar first.')
      return
    }
    setSaving(true)
    try {
      await apiClient.admin.createBlockedSlot({
        date: selectedDate,
        time: time || null,
        scope,
        serviceId: scope === 'Service' ? Number(serviceId) : null,
        reason,
      }, token)
      setMessage('Date blocked. Clients can no longer book it.')
      setReason('')
      await load()
    } catch (reason) {
      setError(formatApiError(reason))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    setError('')
    setMessage('')
    try {
      await apiClient.admin.deleteBlockedSlot(id, token)
      setMessage('Booking time is available again.')
      await load()
    } catch (reason) {
      setError(formatApiError(reason))
    }
  }

  const scopeLabel = (item: BlockedSlot) => item.scope === 'All' ? 'All services and certificates' : item.scope === 'Certificate' ? 'Certificate appointments' : item.serviceName || `Service #${item.serviceId}`
  const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  if (!token) return <section className="operations-page container py-5"><p className="alert alert-warning">Staff sign-in is required.</p></section>

  return <section className="operations-page availability-page admin-embedded-page container-fluid py-4">
    <header className="availability-heading">
      <div>
        <p className="eyebrow">Booking availability</p>
        <h2>Block office dates and times</h2>
        <p>Choose an open date on the calendar, then block the whole day or a specific appointment time.</p>
      </div>
      <p className="availability-hours">Closed Mondays · Tue–Sat 9 AM–5 PM · Sun 9 AM–12 NN</p>
    </header>
    <AdminFeedback message={message} error={error} onDismiss={() => { setMessage(''); setError('') }} />

    <div className="availability-grid">
      <section className="operations-list availability-calendar-panel" aria-label="Select a date to block">
        <h3>Choose a date</h3>
        <div className="availability-calendar">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            events={events}
            dateClick={handleDateClick}
            dayCellClassNames={({ date }) => {
              const key = dateKey(date)
              return [
                ...(key < today || officeHourSlotTimes(key).length === 0 ? ['availability-calendar-closed'] : []),
                ...(key === selectedDate ? ['availability-calendar-selected'] : []),
              ]
            }}
            contentHeight="auto"
            dayMaxEvents={3}
            fixedWeekCount={false}
          />
        </div>
        <p className="availability-calendar-help">Open days are clickable. Mondays and past dates are unavailable for new blocks.</p>
      </section>

      <form className="operations-form availability-form" onSubmit={event => void submit(event)}>
        <h3>New booking block</h3>
        <p className="availability-selected-date">
          {selectedDate ? `Selected: ${formatDate(selectedDate)}` : 'Select an open date on the calendar.'}
        </p>
        <label htmlFor="availability-time">Time</label>
        <select id="availability-time" value={time} onChange={event => setTime(event.target.value)} disabled={!selectedDate}>
          <option value="">Whole day</option>
          {selectedTimes.map(option => <option key={option} value={option}>{option}</option>)}
        </select>

        <label htmlFor="availability-scope">Applies to</label>
        <select id="availability-scope" value={scope} onChange={event => setScope(event.target.value as typeof scope)}>
          <option value="All">All services and certificates</option>
          <option value="Certificate">Certificate appointments</option>
          <option value="Service">A specific service</option>
        </select>

        {scope === 'Service' && <>
          <label htmlFor="availability-service">Service</label>
          <select id="availability-service" required value={serviceId} onChange={event => setServiceId(event.target.value)}>
            <option value="">Select a service</option>
            {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </>}

        <label htmlFor="availability-reason">Reason (shown to clients)</label>
        <input id="availability-reason" maxLength={300} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Parish retreat" />
        {canEdit && <button className="accent" type="submit" disabled={!selectedDate || saving}>
          {saving ? 'Saving…' : 'Block date'}
        </button>}
      </form>

      <section className="operations-list availability-blocked-list">
        <h3>Existing blocks</h3>
        {loading && <p role="status">Loading blocked dates…</p>}
        {!loading && items.length === 0 && <p>No blocked dates or times.</p>}
        {!loading && items.map(item => <article className="availability-blocked-item" key={item.id}>
          <div>
            <strong>{formatDate(item.date)} · {item.time || 'Whole day'}</strong>
            <span>{scopeLabel(item)}</span>
            {item.reason && <small>{item.reason}</small>}
          </div>
          {canEdit && <button className="danger" type="button" onClick={() => void remove(item.id)}>Unblock</button>}
        </article>)}
      </section>
    </div>
  </section>
}
