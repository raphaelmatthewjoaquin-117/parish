import { useEffect, useState } from 'react'
import { API_BASE_URL, apiClient, getMediaUrl } from '../api/client'
import type { ServicePageContent } from '../content/siteContent'
import { isValidServicePageContent } from '../service-page-content.js'
import '../PagesCSS/ServicePageContentEditor.css'

type ServiceOption = { key: string; name: string }

export function ServicePageContentEditor() {
  const [services, setServices] = useState<ServiceOption[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [content, setContent] = useState<ServicePageContent>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      fetch(`${API_BASE_URL}/api/services`).then(response => response.ok
        ? response.json() as Promise<unknown>
        : Promise.reject(new Error('Unable to load service pages.'))),
      apiClient.siteContent.get<ServicePageContent>('services'),
    ]).then(([serviceData, savedContent]) => {
      if (!active) return
      const serviceOptions = Array.isArray(serviceData)
        ? serviceData.reduce<ServiceOption[]>((items, item) => {
            if (!item || typeof item !== 'object') return items
            const row = item as Record<string, unknown>
            const id = Number(row.id ?? row.serviceId)
            if (Number.isSafeInteger(id) && id > 0 && typeof row.name === 'string') {
              items.push({ key: String(id), name: row.name })
            }
            return items
          }, [])
        : []
      const allOptions = [...serviceOptions, { key: 'certificate', name: 'Certificate' }]
      setServices(allOptions)
      setSelectedKey(allOptions[0].key)
      if (savedContent.content && !isValidServicePageContent(savedContent.content)) {
        throw new Error('Saved service page content has an invalid format.')
      }
      setContent(savedContent.content ?? {})
    }).catch(loadError => {
      if (active) setLoadError(loadError instanceof Error ? loadError.message : 'Unable to load service pages.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const selectedService = services.find(service => service.key === selectedKey)
  const selectedContent = content[selectedKey]

  const updateContent = (update: Partial<{ description: string; backgroundImage: string }>) => {
    setContent(current => ({
      ...current,
      [selectedKey]: {
        ...current[selectedKey],
        description: current[selectedKey]?.description ?? '',
        ...update,
      },
    }))
  }

  const uploadBackgroundImage = async (file?: File) => {
    if (!file) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { photoUrl } = await apiClient.siteContent.uploadImage(
        file,
        window.localStorage.getItem('adminToken') || '',
      )
      updateContent({ backgroundImage: photoUrl })
      setSuccess('Image uploaded. Save changes to publish it.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the image.')
    } finally {
      setSaving(false)
    }
  }

  const saveContent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await apiClient.siteContent.save(
        'services',
        content,
        window.localStorage.getItem('adminToken') || '',
      )
      setSuccess('Changes saved and published.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save service page content.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="site-content-editor">
      <header className="site-content-intro">
        <p>Website Content</p>
        <h2>Service Pages</h2>
        <span>Edit the description and optional background image shown on each service tab.</span>
      </header>

      {loading && <p role="status">Loading service pages…</p>}
      {loadError && <p className="alert alert-danger" role="alert">{loadError}</p>}

      {!loading && !loadError && selectedService && (
        <form className="site-content-form" onSubmit={saveContent}>
          <label htmlFor="service-page-select">Service page</label>
          <select
            id="service-page-select"
            value={selectedKey}
            onChange={event => {
              setSelectedKey(event.target.value)
              setError('')
              setSuccess('')
            }}
          >
            {services.map(service => <option key={service.key} value={service.key}>{service.name}</option>)}
          </select>

          <label htmlFor="service-page-description">Description</label>
          <textarea
            id="service-page-description"
            rows={6}
            maxLength={5000}
            value={selectedContent?.description ?? ''}
            onChange={event => updateContent({ description: event.target.value })}
          />

          <label htmlFor="service-page-background">Background image (optional)</label>
          <input
            id="service-page-background"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={saving}
            onChange={event => { void uploadBackgroundImage(event.currentTarget.files?.[0]) }}
          />
          {selectedContent?.backgroundImage && (
            <div className="service-page-image-preview">
              <img src={getMediaUrl(selectedContent.backgroundImage)} alt={`${selectedService.name} background preview`} />
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => updateContent({ backgroundImage: '' })}
              >
                Remove image
              </button>
            </div>
          )}

          {error && <p className="alert alert-danger" role="alert">{error}</p>}
          {success && <p className="alert alert-success" role="status">{success}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </section>
  )
}
