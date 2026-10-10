import { useEffect, useRef, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { apiClient, API_BASE_URL } from '../api/client'
import {
  defaultGalleryContent,
  galleryPhotoUrl,
  galleryPhotoDescription,
  galleryPhotoDescriptionTl,
  localize,
  type GalleryContent,
  type GalleryPhoto,
} from '../content/siteContent'
import type { Language } from '../i18n'
import '../PagesCSS/GalleryPage.css'

function getPhotoUrl(image: string) {
  return image.startsWith('/uploads/') ? `${API_BASE_URL}${image}` : image
}

type LightboxState = { photo: GalleryPhoto; index: number; total: number; albumTitle: string } | null

function Lightbox({
  state,
  language,
  onClose,
  onPrev,
  onNext,
}: {
  state: LightboxState
  language: Language
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus the close button when the lightbox opens
  useEffect(() => {
    if (state) closeRef.current?.focus()
  }, [state])

  // Close on Escape, navigate with arrow keys
  useEffect(() => {
    if (!state) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [state, onClose, onPrev, onNext])

  if (!state) return null

  const description = localize(
    galleryPhotoDescription(state.photo),
    galleryPhotoDescriptionTl(state.photo),
    language,
  )
  const url = getPhotoUrl(galleryPhotoUrl(state.photo))

  return (
    <div
      className="gallery-lightbox-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <dialog
        className="gallery-lightbox"
        open
        aria-label={`${state.albumTitle} photo ${state.index + 1} of ${state.total}`}
        onClick={e => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="gallery-lightbox-close"
          aria-label="Close photo"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="gallery-lightbox-body">
          <button
            type="button"
            className="gallery-lightbox-nav gallery-lightbox-prev"
            aria-label="Previous photo"
            disabled={state.index === 0}
            onClick={onPrev}
          >
            ‹
          </button>

          <figure className="gallery-lightbox-figure">
            <img
              src={url}
              alt={description || `${state.albumTitle} photo ${state.index + 1}`}
              className="gallery-lightbox-img"
            />
            {description && (
              <figcaption className="gallery-lightbox-caption">
                {description}
              </figcaption>
            )}
          </figure>

          <button
            type="button"
            className="gallery-lightbox-nav gallery-lightbox-next"
            aria-label="Next photo"
            disabled={state.index === state.total - 1}
            onClick={onNext}
          >
            ›
          </button>
        </div>

        <p className="gallery-lightbox-counter" aria-live="polite">
          {state.index + 1} / {state.total}
        </p>
      </dialog>
    </div>
  )
}

export function GalleryPage({ language = 'en' }: { language?: Language }) {
  const { albumId } = useParams()
  const [content, setContent] = useState(defaultGalleryContent)
  const [contentLoaded, setContentLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState>(null)

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
    const albumTitle = album ? localize(album.title, album.titleTl, language) : ''
    const photos: GalleryPhoto[] = album ? (album.photos ?? [album.image]) : []

    const openLightbox = (index: number) => {
      if (!album) return
      setLightbox({ photo: photos[index], index, total: photos.length, albumTitle })
    }
    const closeLightbox = () => setLightbox(null)
    const prevPhoto = () => setLightbox(lb => lb && lb.index > 0
      ? { ...lb, photo: photos[lb.index - 1], index: lb.index - 1 }
      : lb)
    const nextPhoto = () => setLightbox(lb => lb && lb.index < photos.length - 1
      ? { ...lb, photo: photos[lb.index + 1], index: lb.index + 1 }
      : lb)

    return (
      <section className="content-section simple-page container py-5">
        <NavLink className="gallery-back-link" to="/gallery">Back to gallery</NavLink>
        {loadError && <p className="error-message" role="status">Unable to load the updated gallery. Showing the default photos.</p>}
        {album ? (
          <div className="gallery-album">
            <h2 data-no-translate>{albumTitle}</h2>
            <div className="gallery-album-photos">
              {photos.map((photo, index) => {
                const url = getPhotoUrl(galleryPhotoUrl(photo))
                const description = localize(
                  galleryPhotoDescription(photo),
                  galleryPhotoDescriptionTl(photo),
                  language,
                )
                return (
                  <button
                    key={galleryPhotoUrl(photo)}
                    type="button"
                    className="gallery-photo-btn"
                    aria-label={description || `${albumTitle} photo ${index + 1} — click to enlarge`}
                    onClick={() => openLightbox(index)}
                  >
                    <img
                      src={url}
                      alt={description || `${albumTitle} photo ${index + 1}`}
                    />
                    {description && (
                      <span className="gallery-photo-caption">{description}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="gallery-album-not-found" role="status">Album not found.</p>
        )}

        <Lightbox
          state={lightbox}
          language={language}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
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