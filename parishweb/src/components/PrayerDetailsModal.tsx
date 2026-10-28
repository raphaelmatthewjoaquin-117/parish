import { createPortal } from 'react-dom'
import './PrayerDetailsModal.css'
import { getPrayerCategoryColor, type PrayerDetails } from '../utils/prayer'

type PrayerDetailsModalProps = {
  prayer: PrayerDetails
  onClose: () => void
  onApprove?: () => void
  onDelete?: () => void
  saving?: boolean
}

export function PrayerDetailsModal({ prayer, onClose, onApprove, onDelete, saving = false }: PrayerDetailsModalProps) {
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return createPortal(
    <div className="prayer-modal-overlay" onClick={onClose}>
      <section
        className="prayer-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prayer-modal-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="prayer-modal-header">
          <div>
            <span className="prayer-modal-category" style={{ backgroundColor: getPrayerCategoryColor(prayer.category) }}>
              {prayer.category}
            </span>
            <span className="prayer-modal-date">{formatDate(prayer.createdAt)}</span>
          </div>
          <button type="button" className="prayer-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="prayer-modal-body">
          <h2 id="prayer-modal-title" className="prayer-modal-title">Prayer Request</h2>
          <p className="prayer-modal-text">{prayer.request}</p>
          {(prayer.shareWithCommunity !== undefined || prayer.isApproved !== undefined) && (
            <div className="prayer-modal-admin-details">
              {prayer.shareWithCommunity !== undefined && (
                <p><strong>Privacy:</strong> {prayer.shareWithCommunity ? 'Shared with community' : 'Private'}</p>
              )}
              {prayer.isApproved !== undefined && (
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`prayer-status-badge ${prayer.isApproved ? 'status-approved' : 'status-pending'}`}>
                    {prayer.isApproved ? 'Approved' : 'Pending Approval'}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="prayer-modal-footer">
          <span className="prayer-modal-name">— {prayer.anonymous ? 'Anonymous' : prayer.name}</span>
          {(onApprove || onDelete) && (
            <div className="prayer-modal-actions">
              {onApprove && !prayer.isApproved && (
                <button type="button" onClick={onApprove} disabled={saving} className="prayer-action-btn prayer-approve-btn">
                  Approve Prayer
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={onDelete} disabled={saving} className="prayer-action-btn prayer-delete-btn">
                  Delete Prayer
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
