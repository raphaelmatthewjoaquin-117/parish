import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../api/client'

type SacramentType = 'baptism' | 'confirmation' | 'marriage' | 'death'

type ArchiveItem = {
  ArchiveId: number
  SacramentType: SacramentType
  BookNumber: number
  PageNumber: number
  RegistryNumber?: string | null
  Notes?: string | null
  UploadedAt: string
  UploadedBy: string
}

type Props = {
  adminToken: string
  canManage: boolean
}

type ArchiveFilters = {
  type: string
  book: string
  page: string
  registry: string
}

const sacramentTypes: SacramentType[] = ['baptism', 'confirmation', 'marriage', 'death']

async function responseJson(response: Response, fallback: string) {
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || fallback)
  return body
}

export function SacramentalArchivesTab({ adminToken, canManage }: Props) {
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sacramentType, setSacramentType] = useState<SacramentType>('baptism')
  const [bookNumber, setBookNumber] = useState('')
  const [pageNumber, setPageNumber] = useState('')
  const [registryNumber, setRegistryNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filters, setFilters] = useState<ArchiveFilters>({ type: '', book: '', page: '', registry: '' })
  const [appliedFilters, setAppliedFilters] = useState<ArchiveFilters>({ type: '', book: '', page: '', registry: '' })
  const [editingArchiveId, setEditingArchiveId] = useState<number | null>(null)

  const loadArchives = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (appliedFilters.type) params.set('sacramentType', appliedFilters.type)
    if (appliedFilters.book) params.set('bookNumber', appliedFilters.book)
    if (appliedFilters.page) params.set('pageNumber', appliedFilters.page)
    if (appliedFilters.registry) params.set('registryNumber', appliedFilters.registry)
    const query = params.toString()
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sacramental/archives${query ? `?${query}` : ''}`, {
        headers: { 'x-admin-token': adminToken },
      })
      const data = await responseJson(response, 'Unable to load sacramental archives.')
      if (!Array.isArray(data.archives)) throw new Error('Invalid archives response.')
      setArchives(data.archives)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load sacramental archives.')
    } finally {
      setLoading(false)
    }
  }, [adminToken, appliedFilters])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadArchives(), 0)
    return () => window.clearTimeout(timer)
  }, [loadArchives])

  const resetForm = () => {
    setEditingArchiveId(null)
    setBookNumber('')
    setPageNumber('')
    setRegistryNumber('')
    setNotes('')
    setFile(null)
  }

  const saveArchive = async () => {
    if (!bookNumber || !pageNumber || (!editingArchiveId && !file)) {
      setError('Provide the book and page number, and choose a scan file.')
      setMessage('')
      return
    }
    if (file && file.size > 20 * 1024 * 1024) {
      setError('Archive files must be 20 MB or smaller.')
      setMessage('')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (editingArchiveId) {
        const response = await fetch(`${API_BASE_URL}/api/admin/sacramental/archives/${editingArchiveId}`, {
          method: 'PUT',
          headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookNumber: Number(bookNumber),
            pageNumber: Number(pageNumber),
            registryNumber: registryNumber.trim() || null,
            notes: notes.trim() || null,
          }),
        })
        await responseJson(response, 'Unable to update archive entry.')
        setMessage('Archive entry updated.')
      } else {
        if (!file) throw new Error('Choose a scan file.')
        const uploadBody = new FormData()
        uploadBody.append('document', file)
        const uploadResponse = await fetch(`${API_BASE_URL}/api/admin/sacramental/upload-archive`, {
          method: 'POST',
          headers: { 'x-admin-token': adminToken },
          body: uploadBody,
        })
        const uploaded = await responseJson(uploadResponse, 'Unable to upload archive file.')
        const response = await fetch(`${API_BASE_URL}/api/admin/sacramental/archives`, {
          method: 'POST',
          headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sacramentType,
            bookNumber: Number(bookNumber),
            pageNumber: Number(pageNumber),
            registryNumber: registryNumber.trim() || null,
            fileUrl: uploaded.fileUrl,
            notes: notes.trim() || null,
          }),
        })
        await responseJson(response, 'Unable to save archive entry.')
        setMessage('Archive uploaded.')
      }
      resetForm()
      await loadArchives()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save archive.')
    } finally {
      setSaving(false)
    }
  }

  const editArchive = (archive: ArchiveItem) => {
    setEditingArchiveId(archive.ArchiveId)
    setSacramentType(archive.SacramentType)
    setBookNumber(String(archive.BookNumber))
    setPageNumber(String(archive.PageNumber))
    setRegistryNumber(archive.RegistryNumber || '')
    setNotes(archive.Notes || '')
    setFile(null)
    setError('')
    setMessage('')
  }

  const deleteArchive = async (archive: ArchiveItem) => {
    if (!window.confirm('Delete this archive entry and its scanned file?')) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sacramental/archives/${archive.ArchiveId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken },
      })
      await responseJson(response, 'Unable to delete archive entry.')
      setMessage('Archive entry removed.')
      await loadArchives()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete archive.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="digital-archives-tab" aria-labelledby="digital-archives-title">
      <header className="ledger-heading">
        <div>
          <h3 id="digital-archives-title">Digital Archives</h3>
          <p className="ledger-description">Find and organize scanned register pages by book, page, or registry number.</p>
        </div>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      {canManage && (
        <section className="archives-list" aria-labelledby="archive-upload-title">
          <h4 id="archive-upload-title">{editingArchiveId ? 'Edit archive details' : 'Add an archive'}</h4>
          <div className="archive-upload-form">
            <label>
              Sacrament type
              <select value={sacramentType} disabled={Boolean(editingArchiveId) || saving} onChange={event => setSacramentType(event.target.value as SacramentType)}>
                {sacramentTypes.map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
              </select>
            </label>
            <label>
              Book number
              <input type="number" min="1" placeholder="e.g. 1" value={bookNumber} onChange={event => setBookNumber(event.target.value)} />
            </label>
            <label>
              Page number
              <input type="number" min="1" placeholder="e.g. 45" value={pageNumber} onChange={event => setPageNumber(event.target.value)} />
            </label>
            <label>
              Registry number (optional)
              <input
                type="text"
                maxLength={50}
                placeholder="Leave blank if not entered in the register"
                value={registryNumber}
                onChange={event => setRegistryNumber(event.target.value)}
              />
            </label>
            <label className="archive-notes-field">
              Notes
              <textarea rows={3} placeholder="Add any helpful details about this scan." value={notes} onChange={event => setNotes(event.target.value)} />
            </label>
            {!editingArchiveId && (
              <label className="archive-file-field">
                Scan file (PDF, PNG, JPG, TIFF · max 20 MB)
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff" onChange={event => setFile(event.target.files?.[0] || null)} />
              </label>
            )}
            <div className="button-row">
              <button type="button" className="primary-btn" disabled={saving} onClick={() => void saveArchive()}>
                {saving ? 'Saving…' : editingArchiveId ? 'Save changes' : 'Upload archive'}
              </button>
              {editingArchiveId && <button type="button" className="secondary-btn" disabled={saving} onClick={resetForm}>Cancel edit</button>}
            </div>
          </div>
        </section>
      )}

      <section className="archives-list" aria-labelledby="archive-list-title">
        <h4 id="archive-list-title">Archive collection</h4>
        <form className="archive-filters" onSubmit={event => { event.preventDefault(); setAppliedFilters({ ...filters }) }}>
          <label>
            Filter by sacrament
            <select value={filters.type} onChange={event => setFilters(previous => ({ ...previous, type: event.target.value }))}>
              <option value="">All types</option>
              {sacramentTypes.map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
            </select>
          </label>
          <label>
            Filter by book number
            <input type="number" min="1" value={filters.book} onChange={event => setFilters(previous => ({ ...previous, book: event.target.value }))} />
          </label>
          <label>
            Filter by page number
            <input type="number" min="1" value={filters.page} onChange={event => setFilters(previous => ({ ...previous, page: event.target.value }))} />
          </label>
          <label>
            Filter by registry number
            <input type="text" value={filters.registry} onChange={event => setFilters(previous => ({ ...previous, registry: event.target.value }))} />
          </label>
          <button type="submit" className="secondary-btn" disabled={loading}>Search archives</button>
        </form>

        {loading && <p role="status">Loading archives…</p>}
        {!loading && archives.length === 0 && <p>No archived documents match these filters.</p>}
        {!loading && archives.length > 0 && (
          <ul>
            {archives.map(archive => (
              <li key={archive.ArchiveId} className="archive-item">
                <div className="archive-info">
                  <strong>{archive.SacramentType}: Book {archive.BookNumber}, Page {archive.PageNumber}</strong>
                  <small>
                    {archive.RegistryNumber ? `Linked to ${archive.RegistryNumber}` : 'Not linked to a register entry'}
                    {' · '}Uploaded by {archive.UploadedBy} on {new Date(archive.UploadedAt).toLocaleDateString()}
                  </small>
                  {archive.Notes && <p>{archive.Notes}</p>}
                </div>
                <div className="button-row">
                  <a
                    href={`${API_BASE_URL}/api/admin/sacramental/archives/${archive.ArchiveId}/file?token=${encodeURIComponent(adminToken)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="archive-link"
                  >
                    View scan
                  </a>
                  {canManage && <>
                    <button type="button" className="secondary-btn" onClick={() => editArchive(archive)} disabled={saving}>Edit</button>
                    <button type="button" className="secondary-btn" onClick={() => void deleteArchive(archive)} disabled={saving}>Delete</button>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
