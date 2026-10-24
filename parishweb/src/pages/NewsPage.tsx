import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { API_BASE_URL as API_URL, apiClient, getMediaUrl } from '../api/client'
import { localize, type NewsContent } from '../content/siteContent'
import type { Language } from '../i18n'
import '../PagesCSS/NewsPage.css'

type EventItem = {
  id: string
  title: string
  titleTl?: string
  description: string
  descriptionTl?: string
  detail: string
  detailTl?: string
  date: string
  location: string
  locationTl?: string
  time?: string
  photoUrl: string
}

type NewsArticle = NewsContent['articles'][number]

const getPhotoUrl = getMediaUrl

export function NewsPage({ language = 'en' }: { language?: Language }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [news, setNews] = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)

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
          const titleTl = String(row.titleTl ?? row.TitleTl ?? '') || undefined
          const description = String(row.description ?? row.Description ?? row.detail ?? row.Detail ?? '')
          const descriptionTl = String(row.descriptionTl ?? row.DescriptionTl ?? '') || undefined
          const detail = String(row.detail ?? row.Detail ?? '')
          const detailTl = String(row.detailTl ?? row.DetailTl ?? '') || undefined
          const date = String(row.date ?? row.EventDate ?? row.Date ?? '')
          const location = String(row.location ?? row.Location ?? '')
          const locationTl = String(row.locationTl ?? row.LocationTl ?? '') || undefined
          const time = String(row.time ?? row.Time ?? '')
          const photoUrl = String(row.photoUrl ?? row.PhotoUrl ?? '')
          if (!date) return result
          result.push({ id, title, titleTl, description, descriptionTl, detail, detailTl, date, location, locationTl, time, photoUrl })
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
    let active = true
    apiClient.siteContent.get<NewsContent>('news')
      .then(({ content }) => {
        if (active) setNews(content?.articles ?? [])
      })
      .catch((err: unknown) => {
        if (active) setNewsError(err instanceof Error ? err.message : 'Unable to load church news.')
      })
      .finally(() => {
        if (active) setNewsLoading(false)
      })
    return () => { active = false }
  }, [])

  const calendarEvents = events.map(event => ({
    title: localize(event.title, event.titleTl, language),
    start: event.date,
  }))

  return (
    <section className="content-section simple-page news-page container py-5">
      <div className="section-heading mb-5">
        <p className="eyebrow">{localize('News & Events', undefined, language)}</p>
        <h2>{localize('Upcoming moments to share', undefined, language)}</h2>
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
          contentHeight="auto"
        />
      </div>

      <div className="event-grid row g-4">
        {loading && <p>Loading events…</p>}
        {error && <p className="error-message">{error}</p>}
        {!loading && !error && events.length === 0 && <p>No upcoming events are published yet.</p>}

        {events.map((event) => (
          <article className="event-card col-md-6 col-lg-4" key={event.id}>
            {event.photoUrl && <img className="event-card-image" src={getPhotoUrl(event.photoUrl)} alt="" />}
            <div className="date-tag">
              {new Date(event.date).toLocaleDateString(language === 'tl' ? 'tl-PH' : 'en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <h3 data-no-translate>{localize(event.title, event.titleTl, language)}</h3>
            <p data-no-translate>{localize(event.description, event.descriptionTl, language)}</p>
            {event.location && (
              <p className="event-location" data-no-translate>{localize(event.location, event.locationTl, language)}</p>
            )}
            <button type="button" className="event-learn-more btn btn-outline-dark" onClick={() => setSelectedEvent(event)}>
              {localize('Learn more', undefined, language)}
            </button>
          </article>
        ))}
      </div>

      <section className="church-news-section" aria-labelledby="church-news-heading">
        <div className="section-heading">
          <p className="eyebrow">{localize('News', 'Balita', language)}</p>
          <h2 id="church-news-heading">{localize('Church news and updates', 'Balita at mga anunsyo ng parokya', language)}</h2>
        </div>
        {newsLoading && <p role="status">{localize('Loading news…', 'Naglo-load ng balita…', language)}</p>}
        {newsError && <p className="error-message" role="alert">{newsError}</p>}
        {!newsLoading && !newsError && news.length === 0 && (
          <p>{localize('No church news is published yet.', 'Wala pang nailalathalang balita ng parokya.', language)}</p>
        )}
        {!newsLoading && !newsError && news.length > 0 && (
          <div className="church-news-list">
            {news.map(article => (
              <article className="church-news-item" key={article.id}>
                {article.image && (
                  <img
                    className="church-news-image"
                    src={getPhotoUrl(article.image)}
                    alt={localize(article.title, article.titleTl, language)}
                    loading="lazy"
                  />
                )}
                {article.date && (
                  <time dateTime={article.date}>
                    {new Date(`${article.date}T00:00:00`).toLocaleDateString(language === 'tl' ? 'tl-PH' : 'en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                )}
                <h3 data-no-translate>{localize(article.title, article.titleTl, language)}</h3>
                <p data-no-translate>{localize(article.body, article.bodyTl, language)}</p>
                {article.link && article.link.trim() && (
                  <a
                    className="church-news-link"
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {localize('Read more', 'Magbasa pa', language)}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          photoUrl={getPhotoUrl(selectedEvent.photoUrl)}
          language={language}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </section>
  )
}
