import { useEffect } from 'react'

export type EventDetails = {
  title: string
  description: string
  detail: string
  date: string
  time?: string
  location: string
  photoUrl: string
}

type EventDetailsModalProps = {
  event: EventDetails
  photoUrl: string
  onClose: () => void
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function EventDetailsModal({ event, photoUrl, onClose }: EventDetailsModalProps) {
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
        <button type="button" className="event-modal-close" onClick={onClose} aria-label="Close event details">
          Close
        </button>
        {event.photoUrl && <img className="event-modal-photo" src={photoUrl} alt="" />}
        <div className="event-modal-content">
          <p className="date-tag">{formatDate(event.date)}</p>
          <h2 id="event-modal-title">{event.title}</h2>
          <dl className="event-modal-fields">
            <div><dt>Description</dt><dd>{event.description || '-'}</dd></div>
            <div><dt>Detail</dt><dd>{event.detail || '-'}</dd></div>
            <div><dt>Date</dt><dd>{formatDate(event.date)}</dd></div>
            <div><dt>Time</dt><dd>{event.time || '-'}</dd></div>
            <div><dt>Location</dt><dd>{event.location || '-'}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  )
}