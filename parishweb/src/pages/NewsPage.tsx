import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { EventDetailsModal } from '../components/EventDetailsModal'
import '../PagesCSS/NewsPage.css'

type EventItem = {
  id: string
  title: string
  description: string
  detail: string
  date: string
  location: string
  time?: string
  photoUrl: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const getPhotoUrl = (photoUrl: string) => (
  photoUrl.startsWith('/') ? `${API_URL}${photoUrl}` : photoUrl
)

export function NewsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)

  useEffect(() => {
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

        const loaded = data.reduce<EventItem[]>((result, item, index) => {
          if (!item || typeof item !== 'object') return result
          const row = item as Record<string, unknown>
          const id = String(row.id ?? row.EventId ?? row.ID ?? `event-${index}`)
          const title = String(row.title ?? row.Title ?? 'Untitled event')
          const description = String(row.description ?? row.Description ?? row.detail ?? row.Detail ?? '')
          const detail = String(row.detail ?? row.Detail ?? '')
          const date = String(row.date ?? row.EventDate ?? row.Date ?? '')
          const location = String(row.location ?? row.Location ?? '')
          const time = String(row.time ?? row.Time ?? '')
          const photoUrl = String(row.photoUrl ?? row.PhotoUrl ?? '')
          if (!date) return result
          result.push({ id, title, description, detail, date, location, time, photoUrl })
          return result
        }, [])

        setEvents(loaded)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load events')
      })
      .finally(() => setLoading(false))
  }, [])

  const calendarEvents = events.map(event => ({
    title: event.title,
    start: event.date,
  }))

  return (
    <section className="content-section simple-page news-page container py-5">
      <div className="section-heading mb-5">
        <p className="eyebrow">News & Events</p>
        <h2>Upcoming moments to share</h2>
      </div>

      <div className="mb-5">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          height="450px"
        />
      </div>

      <div className="event-grid row g-4">
        {loading && <p>Loading events…</p>}
        {error && <p className="error-message">{error}</p>}
        {!loading && !error && events.length === 0 && <p>No upcoming events are published yet.</p>}

        {events.map((event) => (
          <article className="event-card col-md-6 col-lg-4" key={event.id}>
            {event.photoUrl && (
<img className="event-card-image" src={getPhotoUrl(event.photoUrl)} alt="" />)}
            <div className="date-tag">
              {new Date(event.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
            {event.location && <p className="event-location">{event.location}</p>}
            <button type="button" className="event-learn-more btn btn-outline-dark" onClick={() => setSelectedEvent(event)}>
              Learn more
            </button>
          </article>
        ))}
      </div>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          photoUrl={getPhotoUrl(selectedEvent.photoUrl)}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </section>
  )
}
