import { useEffect } from 'react'
import { localize } from '../content/siteContent'
import type { Language } from '../i18n'

export type EventDetails = {
  title: string
  titleTl?: string
  description: string
  descriptionTl?: string
  detail: string
  detailTl?: string
  date: string
  time?: string
  location: string
  locationTl?: string
  photoUrl: string
}

type EventDetailsModalProps = {
  event: EventDetails
  photoUrl: string
  language: Language
  onClose: () => void
}

const formatDate = (date: string, language: Language) => new Date(date).toLocaleDateString(language === 'tl' ? 'tl-PH' : 'en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function EventDetailsModal({ event, photoUrl, language, onClose }: EventDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="event-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        onMouseDown={eventMouseDown => eventMouseDown.stopPropagation()}
      >
        <button
          type="button"
          className="event-modal-close"
          onClick={onClose}
          aria-label={localize('Close', undefined, language)}
        >
          {localize('Close', undefined, language)}
        </button>
        {event.photoUrl && <img className="event-modal-photo" src={photoUrl} alt="" />}
        <div className="event-modal-content">
          <p className="date-tag">{formatDate(event.date, language)}</p>
          <h2 id="event-modal-title" data-no-translate>{localize(event.title, event.titleTl, language)}</h2>
          <dl className="event-modal-fields">
            <div>
              <dt>{localize('Description', undefined, language)}</dt>
              <dd data-no-translate>{localize(event.description, event.descriptionTl, language) || '-'}</dd>
            </div>
            <div>
              <dt>{localize('Detail', undefined, language)}</dt>
              <dd data-no-translate>{localize(event.detail, event.detailTl, language) || '-'}</dd>
            </div>
            <div><dt>{localize('Date', undefined, language)}</dt><dd>{formatDate(event.date, language)}</dd></div>
            <div><dt>{localize('Time', undefined, language)}</dt><dd>{event.time || '-'}</dd></div>
            <div>
              <dt>{localize('Location', undefined, language)}</dt>
              <dd data-no-translate>{localize(event.location, event.locationTl, language) || '-'}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  )
}