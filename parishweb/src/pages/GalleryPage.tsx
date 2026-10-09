import { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { apiClient, API_BASE_URL } from '../api/client'
import { defaultGalleryContent, localize, type GalleryContent } from '../content/siteContent'
import type { Language } from '../i18n'
import '../PagesCSS/GalleryPage.css'

function getPhotoUrl(image: string) {
  return image.startsWith('/uploads/') ? `${API_BASE_URL}${image}` : image
}

export function GalleryPage({ language = 'en' }: { language?: Language }) {
  const { albumId } = useParams()
  const [content, setContent] = useState(defaultGalleryContent)
  const [contentLoaded, setContentLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    apiClient.siteContent.get<GalleryContent>('gallery')
      .then(({ content: saved }) => {
        if (saved) setContent(saved)
        setContentLoaded(true)
      })
      .catch(() => {
        setLoadError(true)
        setContentLoaded(true)
      })
  }, [])

  if (albumId) {
    if (!contentLoaded) {
      return (
        <section className="content-section simple-page container py-5">
          <NavLink className="gallery-back-link" to="/gallery">Back to gallery</NavLink>
          <p role="status">Loading album…</p>
        </section>
      )
    }

    const album = content.items.find(item => item.id === albumId)

    return (
      <section className="content-section simple-page container py-5">
        <NavLink className="gallery-back-link" to="/gallery">Back to gallery</NavLink>
        {loadError && <p className="error-message" role="status">Unable to load the updated gallery. Showing the default photos.</p>}
        {album ? (
          <div className="gallery-album">
            <h2 data-no-translate>{localize(album.title, album.titleTl, language)}</h2>
            <div className="gallery-album-photos">
              {(album.photos ?? [album.image]).map((photo, index) => (
                <img
                  key={photo}
                  src={getPhotoUrl(photo)}
                  alt={`${localize(album.title, album.titleTl, language)} photo ${index + 1}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="gallery-album-not-found" role="status">Album not found.</p>
        )}
      </section>
    )
  }

  return (
    <section className="content-section simple-page container py-5">
      <div className="section-heading mb-5">
        <p className="eyebrow">Gallery</p>
        <h2 data-no-translate>{localize(content.heading, content.headingTl, language)}</h2>
      </div>

      {loadError && <p className="error-message" role="status">Unable to load the updated gallery. Showing the default photos.</p>}
      <div className="gallery-grid row g-4">
        {content.items.map((item, index) => (
          <NavLink
            key={item.id}
            to={`/gallery/${encodeURIComponent(item.id)}`}
            aria-label={`Open ${localize(item.title, item.titleTl, language)} album`}
            className={`gallery-item item-${index + 1} col-12 col-sm-6 col-lg-4 rounded overflow-hidden`}
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.12), rgba(0,0,0,0.4)), url(${getPhotoUrl(item.image)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <span>{localize(item.title, item.titleTl, language)}</span>
          </NavLink>
        ))}
      </div>
    </section>
  )
}