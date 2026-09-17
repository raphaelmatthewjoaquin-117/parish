
import { useEffect, useState } from 'react'

type EventItem = {
  id: string
  title: string
  detail: string
  date: string
  location: string
  photoUrl: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const getPhotoUrl = (photoUrl: string) => (
  photoUrl.startsWith('/') ? `${API_URL}${photoUrl}` : photoUrl
)


export function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          const detail = String(row.detail ?? row.Detail ?? '')
          const date = String(row.date ?? row.EventDate ?? row.Date ?? '')
          const location = String(row.location ?? row.Location ?? '')
          const photoUrl = String(row.photoUrl ?? row.PhotoUrl ?? '')
          if (!date) return result
          result.push({ id, title, detail, date, location, photoUrl })
          return result
        }, [])

        setEvents(loaded)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load events')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <section className="hero" id="home">
        <div className="hero-copy">
         
          <h1>Santo Domingo Parish</h1>
          <p className="lead">
            National Shrine of Our Lady of the Most Holy Rosary La Naval de Manila
          </p>

          <div className="button-row">
            <a href="/contact" className="primary-btn">
              Plan Your Visit
            </a>
            <a href="/about" className="secondary-btn">
              Learn More
            </a>
          </div>

         
        </div>


      </section>

      <section className="content-section" id="news-events">
        <div className="section-heading">
          <p className="eyebrow">News &amp; Events</p>
          <h2>Upcoming moments to share</h2>
        </div>

        <div className="event-grid">
          {loading && <p>Loading events...</p>}
          {error && <p className="error-message">{error}</p>}
          {!loading && !error && events.length === 0 && (
            <p>No upcoming events are published yet.</p>
          )}

          {events.slice(0, 3).map((event) => (
            <article className="event-card" key={event.id}>
              {event.photoUrl && (
                <img className="event-card-image" src={getPhotoUrl(event.photoUrl)} alt="" />
              )}
              <div className="date-tag">
                {new Date(event.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <h3>{event.title}</h3>
              <p>{event.detail}</p>
              {event.location && <p className="event-location">{event.location}</p>}
              <a href="/contact">Learn more</a>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section" id="about-us">
        
      </section>
    </>
  )
}
