
import { useEffect, useState } from 'react'
import { EventDetailsModal } from '../components/EventDetailsModal'
import '../PagesCSS/HomePage.css'

type EventItem = {
  id: string
  title: string
  description: string
  detail: string
  date: string
  time: string
  location: string
  photoUrl: string
}

type VaticanNewsItem = {
  id: string
  title: string
  summary: string
  date: string
  link: string
  imageUrl: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const getPhotoUrl = (photoUrl: string) => (
  photoUrl.startsWith('/') ? `${API_URL}${photoUrl}` : photoUrl
)


export function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [vaticanNews, setVaticanNews] = useState<VaticanNewsItem[]>([])
  const [vaticanNewsLoading, setVaticanNewsLoading] = useState(true)
  const [vaticanNewsError, setVaticanNewsError] = useState<string | null>(null)
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
          const time = String(row.time ?? row.Time ?? '')
          const location = String(row.location ?? row.Location ?? '')
          const photoUrl = String(row.photoUrl ?? row.PhotoUrl ?? '')
          if (!date) return result
          result.push({ id, title, description, detail, date, time, location, photoUrl })
          return result
        }, [])

        setEvents(loaded)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load events')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/api/vatican-news`)
      .then(response => {
        if (!response.ok) throw new Error('Unable to load Vatican News')
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('Invalid Vatican News response')
        setVaticanNews(data as VaticanNewsItem[])
      })
      .catch((err: unknown) => {
        setVaticanNewsError(err instanceof Error ? err.message : 'Unable to load Vatican News')
      })
      .finally(() => setVaticanNewsLoading(false))
  }, [])

  return (
    <>
      <section className="hero container-fluid py-5" id="home">
        <div className="hero-copy">
         
          <h1>Santo Domingo Parish</h1>
          <p className="lead">
            National Shrine of Our Lady of the Most Holy Rosary La Naval de Manila
          </p>

          <div className="button-row d-flex flex-wrap justify-content-center gap-3">
            <a href="/contact" className="primary-btn btn btn-dark">
              Plan Your Visit
            </a>
            <a href="/about" className="secondary-btn btn btn-outline-dark">
              Learn More
            </a>
          </div>

         
        </div>


      </section>

      <section className="content-section container py-5" id="news-events">
        <div className="section-heading">
          <p className="eyebrow"> Events</p>
          <h2>Upcoming moments to share</h2>
        </div>

        <div className="event-grid row g-5">
          {loading && <p>Loading events...</p>}
          {error && <p className="error-message">{error}</p>}
          {!loading && !error && events.length === 0 && (
            <p>No upcoming events are published yet.</p>
          )}

          {events.slice(0, 3).map((event) => (
            <article className="event-card col-sm-6 col-md-4 col-lg-3 card border-0 shadow-sm p-0" key={event.id}>
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
              <p>{event.description}</p>
              {event.location && <p className="event-location">{event.location}</p>}
              <button type="button" className="btn btn-outline-dark m-3" onClick={() => setSelectedEvent(event)}>
                Learn more
              </button>
            </article>
          ))}
        </div>
      </section>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          photoUrl={getPhotoUrl(selectedEvent.photoUrl)}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      <section className="vatican-news content-section container py-5" aria-labelledby="vatican-news-heading">
        <div className="section-heading">
          <p className="eyebrow">From the Holy See</p>
          <h2 id="vatican-news-heading">Vatican News</h2>
        </div>

        {vaticanNewsLoading && <p>Loading Vatican News...</p>}
        {vaticanNewsError && <p className="error-message">{vaticanNewsError}</p>}
        {!vaticanNewsLoading && !vaticanNewsError && (
          <div className="vatican-news-grid row g-4">
            {vaticanNews.slice(0, 3).map((item) => (
              <article className="vatican-news-card col-md-4" key={item.id}>
                {item.imageUrl && <img src={item.imageUrl} alt="" />}
                <div className="vatican-news-card-body">
                  <time dateTime={item.date}>{new Date(item.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}</time>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <a href={item.link} target="_blank" rel="noreferrer">Read on Vatican News</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="content-section" id="about-us">
        
      </section>
    </>
  )
}
