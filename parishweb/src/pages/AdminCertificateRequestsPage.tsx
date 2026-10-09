import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL as API_URL, apiClient, useApiError as formatApiError } from '../api/client'
import '../PagesCSS/AdminOperationsPage.css'

type CertificateRequest = { CertificateRequestId: number; CertificateType: string; PreferredDate: string; PreferredTime: string; Status: string; Notes?: string; FirstName: string; LastName: string; EmailAddress: string; ReferenceCode?: string; DocumentCount?: number }
type CertificateDocument = { CertificateRequestDocumentId: number; OriginalFileName: string; FileUrl: string; MimeType: string; FileSizeBytes: number; UploadedAt: string }
const statuses = ['Requested', 'Confirmed', 'ReadyForClaim', 'Claimed', 'Rejected']
export function AdminCertificateRequestsPage() {
  const [token] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [items, setItems] = useState<CertificateRequest[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [documents, setDocuments] = useState<Record<number, CertificateDocument[]>>({})
  const [documentsLoading, setDocumentsLoading] = useState<number | null>(null)

  const load = useCallback(async () => {
    try { setItems(await apiClient.admin.certificateRequests(token)) } catch (reason) { setError(formatApiError(reason)) }
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

  const update = async (id: number, status: string) => {
    setError(''); setMessage('')
    try { await apiClient.admin.updateCertificateRequest(id, status, token); setMessage('Certificate request updated.'); await load() } catch (reason) { setError(formatApiError(reason)) }
  }

  const toggleDocuments = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (documents[id]) return
    setDocumentsLoading(id)
    setError('')
    try {
      const list = await apiClient.admin.certificateRequestDocuments(id, token)
      setDocuments(previous => ({ ...previous, [id]: Array.isArray(list) ? list : [] }))
    } catch (reason) {
      setError(formatApiError(reason))
    } finally {
      setDocumentsLoading(null)
    }
  }

  if (!token) return <section className="operations-page container py-5"><p className="alert alert-warning">Staff sign-in is required.</p></section>

  return <section className="operations-page admin-embedded-page container-fluid py-4"><div className="operations-heading d-flex align-items-center justify-content-between gap-3"><div><p className="eyebrow">Pastoral administration</p><h1>Certificate appointments</h1></div><button className="btn btn-outline-dark" type="button" onClick={() => void load()}>Refresh</button></div>{message && <p className="success-message alert alert-success">{message}</p>}{error && <p className="error-message alert alert-danger">{error}</p>}<div className="operations-list row g-3">{items.length === 0 ? <p>No certificate appointment requests.</p> : items.map(item => <article className="col-12" key={item.CertificateRequestId}><div className="card border-0 shadow-sm p-3"><div className="d-flex flex-row justify-content-between align-items-center gap-3 flex-wrap"><div><strong>{item.CertificateType} certificate · {item.FirstName} {item.LastName}</strong><span className="d-block">{String(item.PreferredDate).slice(0, 10)} at {item.PreferredTime} · {item.EmailAddress}</span><small className="d-block">{item.Status}{item.ReferenceCode ? ` · Ref ${item.ReferenceCode}` : ''}{item.DocumentCount ? ` · ${item.DocumentCount} document(s)` : ' · No documents'}{item.Notes ? ` · ${item.Notes}` : ''}</small></div><div className="d-flex gap-2 align-items-center"><button className="btn btn-outline-dark btn-sm" type="button" onClick={() => void toggleDocuments(item.CertificateRequestId)}>{expandedId === item.CertificateRequestId ? 'Hide documents' : 'View documents'}</button><select className="form-select w-auto" value={item.Status} onChange={event => void update(item.CertificateRequestId, event.target.value)} aria-label={`Update ${item.CertificateType} request status`}><option disabled>{item.Status}</option>{statuses.filter(status => status !== item.Status).map(status => <option key={status}>{status}</option>)}</select></div></div>{expandedId === item.CertificateRequestId && <div className="mt-3 border-top pt-3">{documentsLoading === item.CertificateRequestId ? <p>Loading documents…</p> : (documents[item.CertificateRequestId] || []).length === 0 ? <p>No documents uploaded.</p> : <ul className="list-unstyled d-flex flex-column gap-2 mb-0">{(documents[item.CertificateRequestId] || []).map(document => <li key={document.CertificateRequestDocumentId} className="d-flex align-items-center gap-2"><span aria-hidden="true">{document.MimeType === 'application/pdf' ? '📄' : '🖼'}</span><a href={`${API_URL}${document.FileUrl}`} target="_blank" rel="noopener noreferrer">{document.OriginalFileName}</a><small className="text-muted">{(document.FileSizeBytes / 1024).toFixed(0)} KB · {new Date(document.UploadedAt).toLocaleDateString()}</small></li>)}</ul>}</div>}</div></article>)}</div></section>
}
