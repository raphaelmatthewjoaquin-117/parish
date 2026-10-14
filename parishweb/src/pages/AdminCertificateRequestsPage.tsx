import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL as API_URL, apiClient, useApiError as formatApiError } from '../api/client'
import { AdminFeedback } from '../components/AdminFeedback'
import '../PagesCSS/AdminOperationsPage.css'

type CertificateRequest = {
  CertificateRequestId: number
  CertificateType: string
  PreferredDate: string
  PreferredTime: string
  Status: string
  Notes?: string
  FirstName: string
  LastName: string
  EmailAddress: string
  ReferenceCode?: string
  DocumentCount?: number
}

type CertificateDocument = {
  CertificateRequestDocumentId: number
  OriginalFileName: string
  FileUrl: string
  MimeType: string
  FileSizeBytes: number
  UploadedAt: string
}

const statuses = ['Requested', 'Confirmed', 'ReadyForClaim', 'Claimed', 'Rejected']
const statusLabels: Record<string, string> = {
  Requested: 'New request',
  Confirmed: 'Confirmed',
  ReadyForClaim: 'Ready for collection',
  Claimed: 'Collected',
  Rejected: 'Declined',
}

const formatDate = (date: string) => {
  const localDate = new Date(`${String(date).slice(0, 10)}T00:00:00`)
  return Number.isNaN(localDate.getTime())
    ? String(date).slice(0, 10)
    : localDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const statusClass = (status: string) => `certificate-request-status--${status.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`

export function AdminCertificateRequestsPage() {
  const [token] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [items, setItems] = useState<CertificateRequest[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [documents, setDocuments] = useState<Record<number, CertificateDocument[]>>({})
  const [documentsLoading, setDocumentsLoading] = useState<number | null>(null)
  const requestButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const selectedRequest = items.find(item => item.CertificateRequestId === selectedId)

  const load = useCallback(async () => {
    try {
      setItems(await apiClient.admin.certificateRequests(token))
    } catch (reason) {
      setError(formatApiError(reason))
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [token, load])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a')
      if (!link || !link.href.includes('/api/admin/certificate-requests/') || !link.href.endsWith('/file')) return
      event.preventDefault()
      void fetch(link.href, { headers: { 'x-admin-token': token } })
        .then(response => response.ok ? response.blob() : Promise.reject(new Error('Unable to open certificate document.')))
        .then(blob => {
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank', 'noopener,noreferrer')
          window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        })
        .catch(reason => setError(formatApiError(reason)))
    }
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [token])

  const closeRequest = useCallback(() => {
    setSelectedId(null)
    requestButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (selectedId === null) return
    closeButtonRef.current?.focus()
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRequest()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], select:not(:disabled)',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleDialogKey)
    return () => document.removeEventListener('keydown', handleDialogKey)
  }, [selectedId, closeRequest])

  const update = async (id: number, status: string) => {
    setError('')
    setMessage('')
    try {
      await apiClient.admin.updateCertificateRequest(id, status, token)
      setMessage('Certificate request updated.')
      await load()
    } catch (reason) {
      setError(formatApiError(reason))
    }
  }

  const deleteRequest = async (request: CertificateRequest) => {
    if (!window.confirm(`Delete the ${request.CertificateType.toLowerCase()} certificate request from ${request.FirstName} ${request.LastName}? This cannot be undone.`)) return
    setError('')
    setMessage('')
    setDeleting(true)
    try {
      const result = await apiClient.admin.deleteCertificateRequest(request.CertificateRequestId, token)
      setMessage(result.message)
      closeRequest()
      await load()
    } catch (reason) {
      setError(formatApiError(reason))
    } finally {
      setDeleting(false)
    }
  }

  const openRequest = async (request: CertificateRequest) => {
    setSelectedId(request.CertificateRequestId)
    if (documents[request.CertificateRequestId]) return
    setDocumentsLoading(request.CertificateRequestId)
    setError('')
    try {
      const list = await apiClient.admin.certificateRequestDocuments(request.CertificateRequestId, token)
      setDocuments(previous => ({
        ...previous,
        [request.CertificateRequestId]: Array.isArray(list) ? list : [],
      }))
    } catch (reason) {
      setError(formatApiError(reason))
    } finally {
      setDocumentsLoading(null)
    }
  }

  if (!token) return <section className="operations-page container py-5"><p className="alert alert-warning">Staff sign-in is required.</p></section>

  return (
    <section className="operations-page admin-embedded-page container-fluid py-4 certificate-requests">
      <AdminFeedback message={message} error={error} onDismiss={() => { setMessage(''); setError('') }} />
      <header className="certificate-requests__heading">
        <div>
          <p className="certificate-requests__eyebrow">Parish office</p>
          <h2>Manage appointment requests</h2>
          <p>Review appointment requests, check supporting documents, and keep each request up to date.</p>
        </div>
        <button className="certificate-requests__refresh" type="button" onClick={() => void load()}>
          <span aria-hidden="true">↻</span> Refresh requests
        </button>
      </header>

      <section className="certificate-requests__list" aria-label="Certificate appointment requests">
        {items.length === 0 ? (
          <div className="certificate-requests__empty">
            <span className="certificate-requests__empty-icon" aria-hidden="true">✦</span>
            <h2>No appointment requests yet</h2>
            <p>New certificate requests will appear here.</p>
          </div>
        ) : items.map(item => (
          <article className="certificate-request-card" key={item.CertificateRequestId}>
            <div className="certificate-request-card__icon" aria-hidden="true">✦</div>
            <div className="certificate-request-card__main">
              <div className="certificate-request-card__heading">
                <div>
                  <p className="certificate-request-card__type">{item.CertificateType} certificate</p>
                  <h2>{item.FirstName} {item.LastName}</h2>
                </div>
                <span className={`certificate-request-status ${statusClass(item.Status)}`}>
                  {statusLabels[item.Status] || item.Status}
                </span>
              </div>
              <div className="certificate-request-card__meta">
                <span><span aria-hidden="true">▦</span> {formatDate(item.PreferredDate)}</span>
                <span><span aria-hidden="true">◷</span> {item.PreferredTime}</span>
                <span><span aria-hidden="true">✉</span> {item.EmailAddress}</span>
              </div>
            </div>
            <div className="certificate-request-card__actions">
              <span className="certificate-request-card__documents">
                {item.DocumentCount || 0} {item.DocumentCount === 1 ? 'document' : 'documents'}
              </span>
              <button
                type="button"
                onClick={event => {
                  requestButtonRef.current = event.currentTarget
                  void openRequest(item)
                }}
              >
                View request
              </button>
            </div>
          </article>
        ))}
      </section>

      {selectedRequest && createPortal(
        <div className="certificate-request-modal" onMouseDown={event => {
          if (event.target === event.currentTarget) closeRequest()
        }}>
          <section
            className="certificate-request-modal__card"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-request-modal-title"
          >
            <header className="certificate-request-modal__header">
              <div>
                <p className="certificate-requests__eyebrow">Appointment request</p>
                <h2 id="certificate-request-modal-title">{selectedRequest.CertificateType} certificate request</h2>
              </div>
              <button ref={closeButtonRef} type="button" className="certificate-request-modal__close" aria-label="Close request details" onClick={closeRequest}>×</button>
            </header>

            <div className="certificate-request-modal__body">
              <div className="certificate-request-modal__person">
                <span className="certificate-request-card__icon" aria-hidden="true">✦</span>
                <div>
                  <h3>{selectedRequest.FirstName} {selectedRequest.LastName}</h3>
                  <a href={`mailto:${selectedRequest.EmailAddress}`}>{selectedRequest.EmailAddress || 'No email provided'}</a>
                </div>
              </div>

              <div className="certificate-request-modal__details">
                <div><span>Requested date</span><strong>{formatDate(selectedRequest.PreferredDate)}</strong></div>
                <div><span>Preferred time</span><strong>{selectedRequest.PreferredTime || 'Not specified'}</strong></div>
                <div><span>Reference number</span><strong>{selectedRequest.ReferenceCode || 'Not assigned'}</strong></div>
                <div>
                  <span>Current status</span>
                  <strong className={`certificate-request-status ${statusClass(selectedRequest.Status)}`}>
                    {statusLabels[selectedRequest.Status] || selectedRequest.Status}
                  </strong>
                </div>
              </div>

              <section className="certificate-request-modal__section">
                <h3>Notes from the requester</h3>
                <p>{selectedRequest.Notes?.trim() || 'No additional notes were provided.'}</p>
              </section>

              <section className="certificate-request-modal__section">
                <div className="certificate-request-modal__section-heading">
                  <h3>Supporting documents</h3>
                  <span>{selectedRequest.DocumentCount || 0}</span>
                </div>
                {documentsLoading === selectedRequest.CertificateRequestId ? (
                  <p className="certificate-request-modal__muted">Loading documents…</p>
                ) : (documents[selectedRequest.CertificateRequestId] || []).length === 0 ? (
                  <p className="certificate-request-modal__muted">No documents uploaded.</p>
                ) : (
                  <ul className="certificate-request-documents">
                    {documents[selectedRequest.CertificateRequestId].map(file => (
                      <li key={file.CertificateRequestDocumentId}>
                        <span className="certificate-request-documents__icon" aria-hidden="true">
                          {file.MimeType === 'application/pdf' ? 'PDF' : 'IMG'}
                        </span>
                        <a href={`${API_URL}${file.FileUrl}`} target="_blank" rel="noopener noreferrer">
                          {file.OriginalFileName}
                        </a>
                        <small>{(file.FileSizeBytes / 1024).toFixed(0)} KB · {new Date(file.UploadedAt).toLocaleDateString()}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <footer className="certificate-request-modal__footer">
              <div className="certificate-request-modal__actions">
                <button
                  type="button"
                  className="certificate-request-modal__delete"
                  disabled={deleting}
                  onClick={() => void deleteRequest(selectedRequest)}
                >
                  {deleting ? 'Deleting…' : 'Delete request'}
                </button>
                <label>
                  Update status
                  <select
                    className="form-select"
                    value={selectedRequest.Status}
                    onChange={event => void update(selectedRequest.CertificateRequestId, event.target.value)}
                    aria-label={`Update ${selectedRequest.CertificateType} request status`}
                  >
                    {statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="certificate-request-modal__done" onClick={closeRequest}>Done</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
