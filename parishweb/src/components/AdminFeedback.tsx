import { createPortal } from 'react-dom'
import '../PagesCSS/AdminFeedback.css'

type AdminFeedbackProps = {
  message?: string | null
  error?: string | null
  onDismiss: () => void
}

export function AdminFeedback({ message, error, onDismiss }: AdminFeedbackProps) {
  const text = error || message
  if (!text) return null

  return createPortal(
    <div className="admin-feedback-layer">
      <div className={`admin-feedback-card ${error ? 'admin-feedback-card--error' : 'admin-feedback-card--success'}`} role={error ? 'alert' : 'status'}>
        <span>{text}</span>
        <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>×</button>
      </div>
    </div>,
    document.body,
  )
}
