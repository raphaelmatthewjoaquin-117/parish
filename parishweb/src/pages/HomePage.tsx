
import { useEffect, useState } from 'react'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { API_BASE_URL as API_URL, apiClient } from '../api/client'
import { defaultGalleryContent, localize, type GalleryContent } from '../content/siteContent'
import type { Language } from '../i18n'
import parishLogo from '../images/SDP logo.png'
import '../PagesCSS/HomePage.css'

type EventItem = {
  id: string
  title: string
  titleTl?: string
  description: string
  descriptionTl?: string
  detail: string
  detailTl?: string
  date: string
  time: string
  location: string
  locationTl?: string
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

const getPhotoUrl = (photoUrl: string) => (
  photoUrl.startsWith('/') ? `${API_URL}${photoUrl}` : photoUrl
)

const getGalleryPhotoUrl = (photoUrl: string) => (
  photoUrl.startsWith('/uploads/') ? `${API_URL}${photoUrl}` : photoUrl
)


export function HomePage({ language = 'en' }: { language?: Language }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [vaticanNews, setVaticanNews] = useState<VaticanNewsItem[]>([])
  const [galleryImage, setGalleryImage] = useState(defaultGalleryContent.items[0]?.image ?? '')
  const [galleryImageAlt, setGalleryImageAlt] = useState(defaultGalleryContent.items[0]?.title ?? 'Santo Domingo Parish')
  const [galleryError, setGalleryError] = useState(false)
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
          const titleTl = String(row.titleTl ?? row.TitleTl ?? '') || undefined
          const description = String(row.description ?? row.Description ?? row.detail ?? row.Detail ?? '')
          const descriptionTl = String(row.descriptionTl ?? row.DescriptionTl ?? '') || undefined
          const detail = String(row.detail ?? row.Detail ?? '')
          const detailTl = String(row.detailTl ?? row.DetailTl ?? '') || undefined
          const date = String(row.date ?? row.EventDate ?? row.Date ?? '')
          const time = String(row.time ?? row.Time ?? '')
          const location = String(row.location ?? row.Location ?? '')
          const locationTl = String(row.locationTl ?? row.LocationTl ?? '') || undefined
          const photoUrl = String(row.photoUrl ?? row.PhotoUrl ?? '')
          if (!date) return result
          result.push({ id, title, titleTl, description, descriptionTl, detail, detailTl, date, time, location, locationTl, photoUrl })
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

  useEffect(() => {
    apiClient.siteContent.get<GalleryContent>('gallery')
      .then(({ content }) => {
        const featuredPhoto = content?.items.find(item => item.image)
        if (featuredPhoto) {
          setGalleryImage(featuredPhoto.image)
          setGalleryImageAlt(featuredPhoto.title)
        }
      })
      .catch((err: unknown) => {
        console.error('Unable to load the homepage gallery preview.', err)
        setGalleryError(true)
      })
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
            <a href="https://www.google.com/maps/place/Santo+Domingo+Church+-+National+Shrine+of+Our+Lady+of+the+Most+Holy+Rosary+(Diocese+of+Cubao)/@14.6264066,121.0079432,17z/data=!3m1!4b1!4m6!3m5!1s0x3397b64000dd2767:0x2cb38929d93bd98d!8m2!3d14.6264014!4d121.0105181!16s%2Fm%2F010rdrv_?entry=ttu&g_ep=EgoyMDI2MDkyOC4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noreferrer" className="primary-btn btn btn-dark">
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
          <p className="eyebrow">{localize('Events', undefined, language)}</p>
          <h2>{localize('Upcoming moments to share', undefined, language)}</h2>
        </div>

        <div className="event-grid row g-5">
          {loading && <p>Loading events...</p>}
          {error && <p className="error-message">{error}</p>}
          {!loading && !error && events.length === 0 && (
            <p>No upcoming events are published yet.</p>
          )}

          {events.slice(0, 3).map((event) => (
            <article className="event-card col-sm-6 col-md-4 col-lg-3 card border-0 p-0" key={event.id}>
              {event.photoUrl && (
                <img className="event-card-image" src={getPhotoUrl(event.photoUrl)} alt="" />
              )}
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
              <button type="button" className="btn btn-outline-dark m-3" onClick={() => setSelectedEvent(event)}>
                {localize('Learn more', undefined, language)}
              </button>
            </article>
          ))}
        </div>
      </section>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          photoUrl={getPhotoUrl(selectedEvent.photoUrl)}
          language={language}
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

      <section className="homepage-community content-section container py-5" aria-label="Parish resources and updates">
        <div className="homepage-community-intro">
          <p className="eyebrow">Discover Santo Domingo</p>
          <h2>Faith, community, and parish life</h2>
          <p>Find a sacrament, revisit a parish moment, or follow our latest updates.</p>
        </div>
        <div className="homepage-community-grid">
          <div className="homepage-community-column">
            <h3 className="homepage-community-title">Sacraments Available</h3>
            <nav className="sacrament-links" aria-label="Available sacraments">
              {[
                { label: 'Baptism', id: 'baptism' },
                { label: 'Marriage', id: 'marriage' },
                { label: 'Confirmation', id: 'confirmation' },
                { label: 'First Communion', id: 'first-communion' },
              ].map(({ label, id }) => (
                <a key={id} href={`/services#${id}`}>{label}</a>
              ))}
            </nav>
          </div>

          <div className="homepage-community-column">
            <h3 className="homepage-community-title">Gallery</h3>
            {galleryError && (
              <p className="gallery-preview-status" role="status">
                Unable to load the latest gallery photo. Showing the default photo.
              </p>
            )}
            {galleryImage && (
              <img className="homepage-gallery-preview" src={getGalleryPhotoUrl(galleryImage)} alt={galleryImageAlt} />
            )}
            <div className="homepage-gallery-actions">
              <a className="homepage-community-button" href="/gallery">More Photos</a>
              
            </div>
          </div>

          <div className="homepage-community-column homepage-facebook-column">
            <h3 className="homepage-community-title">Follow Us on Facebook</h3>
            <a
              className="homepage-facebook-profile"
              href="https://www.facebook.com/stodomingoparishofficialpage/"
              target="_blank"
              rel="noreferrer"
            >
              <img src={parishLogo} alt="" />
              <span>
                <strong>Sto. Domingo Parish</strong>
                <small>Official Facebook page</small>
              </span>
            </a>
            <div className="homepage-facebook-actions">
              <a href="https://www.facebook.com/stodomingoparishofficialpage/" target="_blank" rel="noreferrer">
                Follow Page
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.facebook.com%2Fstodomingoparishofficialpage%2F" target="_blank" rel="noreferrer">
                Share
              </a>
            </div>
            <div className="homepage-facebook-feed-window">
              <iframe
                className="homepage-facebook-embed"
                title="Recent posts from Sto. Domingo Parish on Facebook"
                src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fstodomingoparishofficialpage%2F&tabs=timeline&width=300&height=700&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=true"
                width="300"
                height="700"
                style={{ border: 'none', overflow: 'hidden' }}
                scrolling="no"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="content-section" id="about-us">
        
      </section>
    </>
  )
}
