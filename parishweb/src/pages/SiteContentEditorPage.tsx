import { useEffect, useCallback, useRef, useState } from 'react'
import { apiClient, API_BASE_URL } from '../api/client'
import {
  defaultAboutContent,
  defaultContactContent,
  defaultFooterContent,
  defaultGalleryContent,
  galleryPhotoUrl,
  galleryPhotoDescription,
  galleryPhotoDescriptionTl,
  type AboutContent,
  type ContactContent,
  type FooterContent,
  type GalleryContent,
  type GalleryPhoto,
} from '../content/siteContent'
import '../PagesCSS/SiteContentEditorPage.css'

type SiteContentPage = 'about' | 'gallery' | 'contact' | 'footer'

const publicPagePaths: Record<SiteContentPage, string> = {
  about: '/about',
  gallery: '/gallery',
  contact: '/contact',
  footer: '/',
}

/* ── Collapsible section wrapper ────────────────────────── */
function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  const toggle = useCallback(() => setOpen(prev => !prev), [])

  return (
    <div className={`sce-section ${open ? 'sce-section--open' : ''}`}>
      <button type="button" className="sce-section-toggle" onClick={toggle} aria-expanded={open}>
        <span className="sce-section-chevron" aria-hidden="true">›</span>
        <span className="sce-section-title">{title}</span>
        {subtitle && <span className="sce-section-subtitle">{subtitle}</span>}
      </button>
      {open && <div className="sce-section-body">{children}</div>}
    </div>
  )
}

const getImageUrl = (image: string) => (
  image.startsWith('/uploads/') ? `${API_BASE_URL}${image}` : image
)

/* ── Photo description modal ────────────────────────────── */
function PhotoDescModal({
  photoUrl,
  imagePreviewUrl,
  description,
  descriptionTl,
  onDescriptionChange,
  onDescriptionTlChange,
  onSave,
  onClose,
}: {
  photoUrl: string
  imagePreviewUrl?: string
  description: string
  descriptionTl: string
  onDescriptionChange: (val: string) => void
  onDescriptionTlChange: (val: string) => void
  onSave: () => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const displayUrl = imagePreviewUrl ?? getImageUrl(photoUrl)

  return (
    <div
      className="photo-desc-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <dialog
        className="photo-desc-modal"
        open
        aria-label="Edit photo description"
        onClick={e => e.stopPropagation()}
      >
        <div className="photo-desc-modal-header">
          <h3>Edit photo description</h3>
          <button
            ref={closeRef}
            type="button"
            className="photo-desc-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="photo-desc-modal-body">
          <img
            src={displayUrl}
            alt="Selected photo"
            className="photo-desc-modal-preview"
          />

          <div className="photo-desc-modal-fields">
            <label>
              Description (English)
              <textarea
                rows={4}
                maxLength={1000}
                placeholder="Describe this photo (optional)"
                value={description}
                onChange={e => onDescriptionChange(e.target.value)}
              />
            </label>
            <label>
              Description (Tagalog, optional)
              <textarea
                rows={4}
                maxLength={1000}
                placeholder="Paglalarawan (opsyonal)"
                value={descriptionTl}
                onChange={e => onDescriptionTlChange(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="photo-desc-modal-footer">
          <button type="button" className="btn btn-outline-dark" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-dark" onClick={onSave}>
            Save description
          </button>
        </div>
      </dialog>
    </div>
  )
}

export function SiteContentEditorPage({ page }: { page: SiteContentPage }) {
  const [about, setAbout] = useState<AboutContent>(defaultAboutContent)
  const [gallery, setGallery] = useState<GalleryContent>(defaultGalleryContent)
  const [contact, setContact] = useState<ContactContent>(defaultContactContent)
  const [footer, setFooter] = useState<FooterContent>(defaultFooterContent)
  const [newPhotoTitle, setNewPhotoTitle] = useState('')
  const [newPhotoTitleTl, setNewPhotoTitleTl] = useState('')
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
  const [albumPhotoFiles, setAlbumPhotoFiles] = useState<Record<string, File | null>>({})
  const [photoEditModal, setPhotoEditModal] = useState<{
    albumId: string
    photoUrl: string
    description: string
    descriptionTl: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const closePreviewButtonRef = useRef<HTMLButtonElement>(null)
  const imagePreviewUrlsRef = useRef<Record<string, string>>({})
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({})
  const [previewRevision, setPreviewRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  useEffect(() => () => {
    Object.values(imagePreviewUrlsRef.current).forEach(URL.revokeObjectURL)
  }, [])

  const addImagePreview = (imageUrl: string, file: File) => {
    const previewUrl = URL.createObjectURL(file)
    const previousPreviewUrl = imagePreviewUrlsRef.current[imageUrl]
    if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl)
    imagePreviewUrlsRef.current = { ...imagePreviewUrlsRef.current, [imageUrl]: previewUrl }
    setImagePreviewUrls(imagePreviewUrlsRef.current)
  }

  useEffect(() => {
    if (!previewOpen) return
    closePreviewButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewOpen])

  useEffect(() => {
    let active = true
    apiClient.siteContent.get<AboutContent | GalleryContent | ContactContent | FooterContent>(page)
      .then(({ content }) => {
        if (!active || !content) return
        if (page === 'about') {
          const saved = content as AboutContent
          setAbout({ ...saved, intro: saved.intro ?? defaultAboutContent.intro, timeline: saved.timeline ?? defaultAboutContent.timeline })
        }
        else if (page === 'contact') setContact(content as ContactContent)
        else if (page === 'footer') setFooter(content as FooterContent)
        else setGallery(content as GalleryContent)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load saved content.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page])

  const saveContent = async () => {
    const adminToken = window.localStorage.getItem('adminToken') || ''
    setSaving(true)
    setError(null)
    setSuccess('')
    try {
      if (page === 'about') await apiClient.siteContent.save(page, about, adminToken)
      else if (page === 'contact') await apiClient.siteContent.save(page, contact, adminToken)
      else if (page === 'footer') await apiClient.siteContent.save(page, footer, adminToken)
      else await apiClient.siteContent.save(page, gallery, adminToken)
      Object.values(imagePreviewUrlsRef.current).forEach(URL.revokeObjectURL)
      imagePreviewUrlsRef.current = {}
      setImagePreviewUrls({})
      setPreviewRevision(Date.now())
      setSuccess('Changes saved and published.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save content.')
    } finally {
      setSaving(false)
    }
  }

  const addGalleryPhoto = async () => {
    if (!newPhotoTitle.trim() || !newPhotoFile) {
      setError('Enter a photo title and choose an image first.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess('')
    try {
      const adminToken = window.localStorage.getItem('adminToken') || ''
      const { photoUrl } = await apiClient.siteContent.uploadImage(newPhotoFile, adminToken)
      addImagePreview(photoUrl, newPhotoFile)
      setGallery(current => ({
        ...current,
        items: [...current.items, {
          id: crypto.randomUUID(),
          title: newPhotoTitle.trim(),
          titleTl: newPhotoTitleTl.trim() || undefined,
          image: photoUrl,
          photos: [photoUrl],
        }],
      }))
      setNewPhotoTitle('')
      setNewPhotoTitleTl('')
      setNewPhotoFile(null)
      const input = document.getElementById('gallery-photo-file') as HTMLInputElement | null
      if (input) input.value = ''
      setSuccess('Photo uploaded. Save changes to publish it to the gallery.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload photo.')
    } finally {
      setSaving(false)
    }
  }

  const addPhotoToAlbum = async (albumId: string) => {
    const file = albumPhotoFiles[albumId]
    const album = gallery.items.find(item => item.id === albumId)
    if (!file || !album) {
      setError('Choose an image to add to the album.')
      return
    }
    const photos = album.photos ?? [album.image]
    if (photos.length >= 100) {
      setError('An album cannot contain more than 100 photos.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess('')
    try {
      const adminToken = window.localStorage.getItem('adminToken') || ''
      const { photoUrl } = await apiClient.siteContent.uploadImage(file, adminToken)
      addImagePreview(photoUrl, file)
      // New photos start as objects so descriptions can be added later
      const newEntry: GalleryPhoto = { url: photoUrl }
      updateGalleryItem(albumId, { photos: [...photos, newEntry] })
      setAlbumPhotoFiles(current => ({ ...current, [albumId]: null }))
      const input = document.getElementById(`gallery-photo-${albumId}`) as HTMLInputElement | null
      if (input) input.value = ''
      setSuccess(`Photo added to ${album.title}. Save changes to publish it.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload photo.')
    } finally {
      setSaving(false)
    }
  }

  const removeAlbumPhoto = (albumId: string, photoUrl: string) => {
    setGallery(current => ({
      ...current,
      items: current.items.map(item => {
        if (item.id !== albumId) return item
        const photos = (item.photos ?? [item.image]).filter(photo => galleryPhotoUrl(photo) !== photoUrl)
        if (photos.length === 0) return item
        return {
          ...item,
          photos,
          image: item.image === photoUrl ? galleryPhotoUrl(photos[0]) : item.image,
        }
      }),
    }))
  }

  const updatePhotoDescription = (albumId: string, photoUrl: string, description: string, descriptionTl: string) => {
    setGallery(current => ({
      ...current,
      items: current.items.map(item => {
        if (item.id !== albumId) return item
        const photos = (item.photos ?? [item.image]).map(photo => {
          if (galleryPhotoUrl(photo) !== photoUrl) return photo
          return { url: photoUrl, description: description || undefined, descriptionTl: descriptionTl || undefined }
        })
        return { ...item, photos }
      }),
    }))
  }

  const uploadHeroImage = async (file: File | undefined) => {
    if (!file) return
    setSaving(true)
    setError(null)
    setSuccess('')
    try {
      const adminToken = window.localStorage.getItem('adminToken') || ''
      const { photoUrl } = await apiClient.siteContent.uploadImage(file, adminToken)
      addImagePreview(photoUrl, file)
      setAbout(current => ({ ...current, heroImage: photoUrl }))
      setSuccess('Banner image uploaded. Save changes to publish it.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload image.')
    } finally {
      setSaving(false)
    }
  }

  const updateTimeline = (index: number, changes: Partial<NonNullable<AboutContent['timeline']>[number]>) => {
    setAbout(current => ({
      ...current,
      timeline: (current.timeline ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }))
  }

  const updateContactCard = (index: number, changes: Partial<ContactContent['cards'][number]>) => {
    setContact(current => ({
      ...current,
      cards: current.cards.map((card, cardIndex) => cardIndex === index ? { ...card, ...changes } : card),
    }))
  }

  const updateFooterQuickLink = (index: number, changes: Partial<FooterContent['quickLinks'][number]>) => {
    setFooter(current => ({
      ...current,
      quickLinks: current.quickLinks.map((link, linkIndex) => linkIndex === index ? { ...link, ...changes } : link),
    }))
  }

  const updateGalleryItem = (id: string, changes: Partial<GalleryContent['items'][number]>) => {
    setGallery(current => ({
      ...current,
      items: current.items.map(item => item.id === id ? { ...item, ...changes } : item),
    }))
  }

  return (
    <section className={`site-content-editor site-content-editor--${page}`}>
      <div className="site-content-intro">
        <p>Website content</p>
        <h2>{page === 'about' ? 'Edit About Us page' : page === 'contact' ? 'Edit Contact page' : page === 'footer' ? 'Edit website footer' : 'Edit photo gallery'}</h2>
        <span>Changes are published on the public website when you save.</span>
      </div>

      {error && <p className="site-content-message error-message" role="alert">{error}</p>}
      {success && <p className="site-content-message success-message" role="status">{success}</p>}
      {loading && <p>Loading saved content…</p>}

      {page === 'about' ? (
        <div className="site-content-form">
          {/* ── Heading & Banner ── */}
          <CollapsibleSection title="Heading & Banner" subtitle="Page title, intro, and banner image" defaultOpen>
            <label>
              Page heading
              <input value={about.heading} maxLength={300} onChange={event => setAbout(current => ({ ...current, heading: event.target.value }))} />
            </label>
            <label>
              Page heading (Tagalog)
              <input value={about.headingTl ?? ''} maxLength={300} onChange={event => setAbout(current => ({ ...current, headingTl: event.target.value }))} />
            </label>
            <label>
              Intro line (shown under the heading)
              <input value={about.intro ?? ''} maxLength={1000} onChange={event => setAbout(current => ({ ...current, intro: event.target.value }))} />
            </label>
            <label>
              Intro line (Tagalog)
              <input value={about.introTl ?? ''} maxLength={1000} onChange={event => setAbout(current => ({ ...current, introTl: event.target.value }))} />
            </label>
            <div className="upload-field">
              <span className="upload-field-label">Banner image <span style={{ fontWeight: 400, color: '#6b746d' }}>(optional)</span></span>
              <label className={`upload-tile${saving ? ' upload-tile--uploading' : ''}`} aria-label="Upload banner image">
                <input type="file" accept="image/*" disabled={saving} onChange={event => { void uploadHeroImage(event.target.files?.[0]); event.target.value = '' }} />
                <span className="upload-tile-icon" aria-hidden="true">{saving ? '…' : '+'}</span>
                <span className="upload-tile-name">{saving ? 'Uploading…' : 'Choose image'}</span>
              </label>
            </div>
            {about.heroImage && (
              <div className="site-content-row">
                <img src={imagePreviewUrls[about.heroImage] ?? getImageUrl(about.heroImage)} alt="Banner preview" style={{ maxWidth: 240, borderRadius: 6 }} />
                <button type="button" className="btn btn-outline-danger" onClick={() => setAbout(current => ({ ...current, heroImage: undefined }))}>Remove banner image</button>
              </div>
            )}
          </CollapsibleSection>

          {/* ── About text ── */}
          <CollapsibleSection title="About Text" subtitle={`${about.paragraphs.length} paragraph${about.paragraphs.length !== 1 ? 's' : ''}`}>
            <div className="site-content-list-heading">
              <h3>Paragraphs</h3>
              <button type="button" className="btn btn-outline-dark" onClick={() => setAbout(current => ({ ...current, paragraphs: [...current.paragraphs, ''] }))}>Add paragraph</button>
            </div>
            {about.paragraphs.map((paragraph, index) => (
              <div className="site-content-row" key={`paragraph-${index}`}>
                <label>
                  Paragraph {index + 1}
                  <textarea value={paragraph} rows={4} onChange={event => setAbout(current => ({
                    ...current,
                    paragraphs: current.paragraphs.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                  }))} />
                </label>
                <label>
                  Paragraph {index + 1} (Tagalog)
                  <textarea value={about.paragraphsTl?.[index] ?? ''} rows={4} onChange={event => setAbout(current => {
                    const paragraphsTl = current.paragraphs.map((_, itemIndex) => current.paragraphsTl?.[itemIndex] ?? '')
                    paragraphsTl[index] = event.target.value
                    return { ...current, paragraphsTl }
                  })} />
                </label>
                <button type="button" className="btn btn-outline-danger" onClick={() => setAbout(current => ({
                  ...current,
                  paragraphs: current.paragraphs.filter((_, itemIndex) => itemIndex !== index),
                  paragraphsTl: current.paragraphsTl?.filter((_, itemIndex) => itemIndex !== index),
                }))}>Remove</button>
              </div>
            ))}
          </CollapsibleSection>

          {/* ── Parish statistics ── */}
          <CollapsibleSection title="Parish Statistics" subtitle={`${about.stats.length} stat${about.stats.length !== 1 ? 's' : ''}`}>
            <div className="site-content-list-heading">
              <h3>Statistics</h3>
              <button type="button" className="btn btn-outline-dark" onClick={() => setAbout(current => ({ ...current, stats: [...current.stats, { value: '', label: '' }] }))}>Add statistic</button>
            </div>
            {about.stats.map((stat, index) => (
              <div className="site-content-row site-content-stat" key={`stat-${index}`}>
                <label>
                  Value
                  <input value={stat.value} maxLength={100} onChange={event => setAbout(current => ({
                    ...current,
                    stats: current.stats.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item),
                  }))} />
                </label>
                <label>
                  Label
                  <input value={stat.label} maxLength={300} onChange={event => setAbout(current => ({
                    ...current,
                    stats: current.stats.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item),
                  }))} />
                </label>
                <label>
                  Label (Tagalog)
                  <input value={stat.labelTl ?? ''} maxLength={300} onChange={event => setAbout(current => ({
                    ...current,
                    stats: current.stats.map((item, itemIndex) => itemIndex === index ? { ...item, labelTl: event.target.value } : item),
                  }))} />
                </label>
                <button type="button" className="btn btn-outline-danger" onClick={() => setAbout(current => ({
                  ...current,
                  stats: current.stats.filter((_, itemIndex) => itemIndex !== index),
                }))}>Remove</button>
              </div>
            ))}
          </CollapsibleSection>

          {/* ── History timeline ── */}
          <CollapsibleSection title="History Timeline" subtitle={`${(about.timeline ?? []).length} milestone${(about.timeline ?? []).length !== 1 ? 's' : ''}`}>
            <div className="site-content-list-heading">
              <h3>Milestones</h3>
              <button type="button" className="btn btn-outline-dark" onClick={() => setAbout(current => ({ ...current, timeline: [...(current.timeline ?? []), { year: '', title: '', description: '' }] }))}>Add milestone</button>
            </div>
            {(about.timeline ?? []).map((item, index) => (
              <div className="site-content-row" key={`timeline-${index}`}>
                <label>
                  Year / period
                  <input value={item.year} maxLength={50} onChange={event => updateTimeline(index, { year: event.target.value })} />
                </label>
                <label>
                  Title
                  <input value={item.title} maxLength={200} onChange={event => updateTimeline(index, { title: event.target.value })} />
                </label>
                <label>
                  Title (Tagalog)
                  <input value={item.titleTl ?? ''} maxLength={200} onChange={event => updateTimeline(index, { titleTl: event.target.value })} />
                </label>
                <label>
                  Description
                  <textarea value={item.description} rows={3} maxLength={2000} onChange={event => updateTimeline(index, { description: event.target.value })} />
                </label>
                <label>
                  Description (Tagalog)
                  <textarea value={item.descriptionTl ?? ''} rows={3} maxLength={2000} onChange={event => updateTimeline(index, { descriptionTl: event.target.value })} />
                </label>
                <button type="button" className="btn btn-outline-danger" onClick={() => setAbout(current => ({
                  ...current,
                  timeline: (current.timeline ?? []).filter((_, itemIndex) => itemIndex !== index),
                }))}>Remove</button>
              </div>
            ))}
          </CollapsibleSection>

          {/* ── Quote ── */}
          <CollapsibleSection title="Quote" subtitle={about.quote?.text ? 'Set' : 'Optional'}>
            <label>
              Quote text
              <textarea value={about.quote?.text ?? ''} rows={2} maxLength={1000} onChange={event => setAbout(current => ({ ...current, quote: { ...current.quote, text: event.target.value } }))} />
            </label>
            <label>
              Quote text (Tagalog)
              <textarea value={about.quote?.textTl ?? ''} rows={2} maxLength={1000} onChange={event => setAbout(current => ({ ...current, quote: { text: '', ...current.quote, textTl: event.target.value } }))} />
            </label>
            <label>
              Attribution
              <input value={about.quote?.attribution ?? ''} maxLength={200} onChange={event => setAbout(current => ({ ...current, quote: { text: '', ...current.quote, attribution: event.target.value } }))} />
            </label>
          </CollapsibleSection>
        </div>
      ) : page === 'contact' ? (
        <div className="site-content-form">
          <CollapsibleSection title="Heading" subtitle="Page title and introduction" defaultOpen>
            <label>
              Eyebrow label
              <input value={contact.eyebrow ?? ''} maxLength={100} onChange={event => setContact(current => ({ ...current, eyebrow: event.target.value }))} />
            </label>
            <label>
              Eyebrow label (Tagalog)
              <input value={contact.eyebrowTl ?? ''} maxLength={100} onChange={event => setContact(current => ({ ...current, eyebrowTl: event.target.value }))} />
            </label>
            <label>
              Page heading
              <input value={contact.heading} maxLength={300} onChange={event => setContact(current => ({ ...current, heading: event.target.value }))} />
            </label>
            <label>
              Page heading (Tagalog)
              <input value={contact.headingTl ?? ''} maxLength={300} onChange={event => setContact(current => ({ ...current, headingTl: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea value={contact.description ?? ''} rows={3} maxLength={1000} onChange={event => setContact(current => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              Description (Tagalog)
              <textarea value={contact.descriptionTl ?? ''} rows={3} maxLength={1000} onChange={event => setContact(current => ({ ...current, descriptionTl: event.target.value }))} />
            </label>
          </CollapsibleSection>

          <CollapsibleSection title="Contact Cards" subtitle={`${contact.cards.length} card${contact.cards.length !== 1 ? 's' : ''}`}>
            <div className="site-content-list-heading">
              <div>
                <h3>Contact cards</h3>
                <p>Choose how each card should appear on the public Contact page.</p>
              </div>
              <button type="button" className="btn btn-outline-dark" disabled={contact.cards.length >= 12} onClick={() => setContact(current => ({ ...current, cards: [...current.cards, { type: 'visit', title: '', lines: [''] }] }))}>Add card</button>
            </div>
            {contact.cards.length === 0 && (
              <p className="sce-contact-cards-empty">No contact cards yet. Add one to show visitors your address, phone number, or email.</p>
            )}
            {contact.cards.map((card, index) => (
              <div className="sce-contact-card" key={`card-${index}`}>
                <div className="sce-contact-card-heading">
                  <span>Contact card {index + 1}</span>
                  <button type="button" className="btn btn-outline-danger" onClick={() => setContact(current => ({
                    ...current,
                    cards: current.cards.filter((_, cardIndex) => cardIndex !== index),
                  }))}>Remove card</button>
                </div>
                <div className="sce-contact-card-fields">
                  <label>
                    Card type
                    <select value={card.type} onChange={event => updateContactCard(index, { type: event.target.value as ContactContent['cards'][number]['type'] })}>
                      <option value="visit">Visit — address</option>
                      <option value="call">Call — phone number</option>
                      <option value="email">Email — email address</option>
                    </select>
                    <small>Sets the icon and makes the address, phone, or email actionable.</small>
                  </label>
                  <label>
                    Title
                    <input value={card.title} maxLength={200} onChange={event => updateContactCard(index, { title: event.target.value })} />
                  </label>
                  <label>
                    Title (Tagalog)
                    <input value={card.titleTl ?? ''} maxLength={200} onChange={event => updateContactCard(index, { titleTl: event.target.value })} />
                  </label>
                  <label>
                    Details (one per line)
                    <textarea value={card.lines.join('\n')} rows={4} onChange={event => updateContactCard(index, { lines: event.target.value.split('\n').slice(0, 10) })} />
                    <small>For phone and email cards, the first line is used for the call or email link.</small>
                  </label>
                  <label>
                    Details (Tagalog, same order; optional)
                    <textarea value={(card.linesTl ?? []).join('\n')} rows={4} onChange={event => updateContactCard(index, { linesTl: event.target.value.split('\n').slice(0, 10) })} />
                  </label>
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Message Form" subtitle="Title and description above the form">
            <label>
              Form title
              <input value={contact.formTitle ?? ''} maxLength={200} onChange={event => setContact(current => ({ ...current, formTitle: event.target.value }))} />
            </label>
            <label>
              Form title (Tagalog)
              <input value={contact.formTitleTl ?? ''} maxLength={200} onChange={event => setContact(current => ({ ...current, formTitleTl: event.target.value }))} />
            </label>
            <label>
              Form description
              <textarea value={contact.formDescription ?? ''} rows={3} maxLength={1000} onChange={event => setContact(current => ({ ...current, formDescription: event.target.value }))} />
            </label>
            <label>
              Form description (Tagalog)
              <textarea value={contact.formDescriptionTl ?? ''} rows={3} maxLength={1000} onChange={event => setContact(current => ({ ...current, formDescriptionTl: event.target.value }))} />
            </label>
          </CollapsibleSection>
        </div>
      ) : page === 'footer' ? (
        <div className="site-content-form">
          <CollapsibleSection title="Parish information" subtitle="Name and location" defaultOpen>
            <label>
              Parish name
              <input value={footer.parishTitle} maxLength={200} onChange={event => setFooter(current => ({ ...current, parishTitle: event.target.value }))} />
            </label>
            <label>
              Address (one line per entry)
              <textarea value={footer.addressLines.join('\n')} rows={3} onChange={event => setFooter(current => ({ ...current, addressLines: event.target.value.split('\n').slice(0, 10) }))} />
            </label>
          </CollapsibleSection>

          <CollapsibleSection title="Mass and office hours" subtitle="Schedules shown in the footer">
            <label>
              Mass schedule heading
              <input value={footer.scheduleTitle} maxLength={100} onChange={event => setFooter(current => ({ ...current, scheduleTitle: event.target.value }))} />
            </label>
            <label>
              Mass schedule (one line per entry)
              <textarea value={footer.scheduleLines.join('\n')} rows={4} onChange={event => setFooter(current => ({ ...current, scheduleLines: event.target.value.split('\n').slice(0, 20) }))} />
            </label>
            <label>
              Office hours heading
              <input value={footer.officeHoursTitle} maxLength={100} onChange={event => setFooter(current => ({ ...current, officeHoursTitle: event.target.value }))} />
            </label>
            <label>
              Office hours (one line per entry)
              <textarea value={footer.officeHoursLines.join('\n')} rows={3} onChange={event => setFooter(current => ({ ...current, officeHoursLines: event.target.value.split('\n').slice(0, 20) }))} />
            </label>
          </CollapsibleSection>

          <CollapsibleSection title="Contact and navigation" subtitle="Contact details and footer links">
            <label>
              Contact heading
              <input value={footer.contactTitle} maxLength={100} onChange={event => setFooter(current => ({ ...current, contactTitle: event.target.value }))} />
            </label>
            <label>
              Contact introduction
              <textarea value={footer.contactIntro} rows={2} maxLength={500} onChange={event => setFooter(current => ({ ...current, contactIntro: event.target.value }))} />
            </label>
            <label>
              Phone numbers (one per line)
              <textarea value={footer.phoneNumbers.join('\n')} rows={3} onChange={event => setFooter(current => ({ ...current, phoneNumbers: event.target.value.split('\n').slice(0, 10) }))} />
            </label>
            <label>
              Email address
              <input type="email" value={footer.email} maxLength={320} onChange={event => setFooter(current => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              Quick links heading
              <input value={footer.quickLinksTitle} maxLength={100} onChange={event => setFooter(current => ({ ...current, quickLinksTitle: event.target.value }))} />
            </label>
            {footer.quickLinks.map((link, index) => (
              <div className="site-content-row site-content-footer-link" key={`footer-link-${index}`}>
                <label>
                  Link label
                  <input value={link.label} maxLength={100} onChange={event => updateFooterQuickLink(index, { label: event.target.value })} />
                </label>
                <label>
                  Site path (must start with /)
                  <input value={link.path} maxLength={500} onChange={event => updateFooterQuickLink(index, { path: event.target.value })} />
                </label>
                <button type="button" className="btn btn-outline-danger" onClick={() => setFooter(current => ({
                  ...current,
                  quickLinks: current.quickLinks.filter((_, linkIndex) => linkIndex !== index),
                }))}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn btn-outline-dark" disabled={footer.quickLinks.length >= 12} onClick={() => setFooter(current => ({ ...current, quickLinks: [...current.quickLinks, { label: '', path: '/' }] }))}>Add quick link</button>
            <label>
              Copyright line
              <input value={footer.copyright} maxLength={300} onChange={event => setFooter(current => ({ ...current, copyright: event.target.value }))} />
            </label>
          </CollapsibleSection>
        </div>
      ) : (
        <div className="site-content-form">
          <label>
            Page heading
            <input value={gallery.heading} maxLength={300} onChange={event => setGallery(current => ({ ...current, heading: event.target.value }))} />
          </label>
          <label>
            Page heading (Tagalog)
            <input value={gallery.headingTl ?? ''} maxLength={300} onChange={event => setGallery(current => ({ ...current, headingTl: event.target.value }))} />
          </label>

          <div className="site-content-add-photo">
            <h3>Create an album</h3>
            <label>
              New album title
              <input value={newPhotoTitle} maxLength={200} onChange={event => setNewPhotoTitle(event.target.value)} />
            </label>
            <label>
              New album title (Tagalog, optional)
              <input value={newPhotoTitleTl} maxLength={200} onChange={event => setNewPhotoTitleTl(event.target.value)} />
            </label>
            <div className="upload-field">
              <span className="upload-field-label">New album photo</span>
              <label className={`upload-tile${newPhotoFile ? ' upload-tile--ready' : ''}`} aria-label="Choose cover photo for new album">
                <input id="gallery-photo-file" type="file" accept="image/*" onChange={event => setNewPhotoFile(event.target.files?.[0] || null)} />
                <span className="upload-tile-icon" aria-hidden="true">{newPhotoFile ? '✓' : '+'}</span>
                <span className="upload-tile-name">{newPhotoFile ? newPhotoFile.name : 'Choose photo'}</span>
                {newPhotoFile && (
                  <button
                    type="button"
                    className="upload-tile-clear"
                    aria-label="Clear selected photo"
                    onClick={e => { e.preventDefault(); setNewPhotoFile(null) }}
                  >✕</button>
                )}
              </label>
            </div>
            <button type="button" className="btn btn-outline-dark" disabled={saving || gallery.items.length >= 100} onClick={() => void addGalleryPhoto()}>
              Create album
            </button>
            <small>Images must be under 5 MB. You can add up to 100 albums; new albums and photos appear publicly after saving changes.</small>
          </div>

          <div className="site-content-list-heading">
            <h3>Gallery albums</h3>
            <span>{gallery.items.length} album{gallery.items.length !== 1 ? 's' : ''}</span>
          </div>
          {gallery.items.map(item => {
            const albumPhotos = item.photos ?? [item.image]
            return (
              <CollapsibleSection
                key={item.id}
                title={item.title || 'Untitled album'}
                subtitle={`${albumPhotos.length} photo${albumPhotos.length !== 1 ? 's' : ''}`}
              >
                <div className="album-editor">
                  {/* ── Meta row: title fields + danger action ── */}
                  <div className="album-editor-meta">
                    <label className="album-editor-field">
                      Album title
                      <input value={item.title} maxLength={200} onChange={event => updateGalleryItem(item.id, { title: event.target.value })} />
                    </label>
                    <label className="album-editor-field">
                      Album title (Tagalog)
                      <input value={item.titleTl ?? ''} maxLength={200} onChange={event => updateGalleryItem(item.id, { titleTl: event.target.value })} />
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline-danger album-editor-remove"
                      disabled={saving}
                      onClick={() => setGallery(current => ({
                        ...current,
                        items: current.items.filter(album => album.id !== item.id),
                      }))}
                    >
                      Delete album
                    </button>
                  </div>

                  {/* ── Photo grid ── */}
                  <p className="album-editor-section-label">
                    Photos · click a photo to edit its description
                  </p>
                  <div className="album-photo-grid">
                    {albumPhotos.map((photo, index, photos) => {
                      const url = galleryPhotoUrl(photo)
                      const description = galleryPhotoDescription(photo)
                      const descriptionTl = galleryPhotoDescriptionTl(photo)
                      const isCover = url === item.image
                      const hasDesc = !!(description || descriptionTl)
                      return (
                        <div
                          key={url}
                          className={`album-photo-tile${isCover ? ' album-photo-tile--cover' : ''}`}
                        >
                          <button
                            type="button"
                            className="album-photo-tile-img-btn"
                            aria-label={`Edit description for photo ${index + 1}`}
                            onClick={() => setPhotoEditModal({
                              albumId: item.id,
                              photoUrl: url,
                              description,
                              descriptionTl,
                            })}
                          >
                            <img
                              src={imagePreviewUrls[url] ?? `${getImageUrl(url)}${url.startsWith('/uploads/') ? `?preview=${previewRevision}` : ''}`}
                              alt={`${item.title} photo ${index + 1}`}
                            />
                            {isCover && <span className="album-photo-cover-badge" aria-hidden="true">Cover</span>}
                            {hasDesc && <span className="album-photo-desc-badge" aria-hidden="true">✎</span>}
                          </button>
                          {!isCover && (
                            <button
                              type="button"
                              className="album-photo-set-cover-btn"
                              aria-label={`Set photo ${index + 1} as album cover`}
                              onClick={() => updateGalleryItem(item.id, { image: url })}
                            >
                              Set cover
                            </button>
                          )}
                          <button
                            type="button"
                            className="album-photo-remove-btn"
                            aria-label={`Remove photo ${index + 1} from ${item.title}`}
                            disabled={saving || photos.length <= 1}
                            onClick={() => removeAlbumPhoto(item.id, url)}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}

                    {/* ── Upload tile ── */}
                    <label
                      className={`album-photo-upload-tile${albumPhotoFiles[item.id] ? ' album-photo-upload-tile--ready' : ''}`}
                      aria-label={`Add a photo to ${item.title}`}
                    >
                      <input
                        id={`gallery-photo-${item.id}`}
                        type="file"
                        accept="image/*"
                        disabled={saving || albumPhotos.length >= 100}
                        onChange={event => setAlbumPhotoFiles(current => ({ ...current, [item.id]: event.target.files?.[0] ?? null }))}
                      />
                      {albumPhotoFiles[item.id] ? (
                        <>
                          <span className="album-upload-icon" aria-hidden="true">✓</span>
                          <span className="album-upload-label">{albumPhotoFiles[item.id]!.name}</span>
                          <button
                            type="button"
                            className="album-upload-confirm-btn"
                            disabled={saving}
                            onClick={event => { event.preventDefault(); void addPhotoToAlbum(item.id) }}
                          >
                            {saving ? 'Uploading…' : 'Upload'}
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="album-upload-icon" aria-hidden="true">+</span>
                          <span className="album-upload-label">Add photo</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </CollapsibleSection>
            )
          })}
        </div>
      )}

      <div className="site-content-save">
        <button className="btn btn-outline-dark" type="button" onClick={() => setPreviewOpen(true)}>
          View page
        </button>
        <button type="button" className="btn btn-dark" disabled={loading || saving} onClick={() => void saveContent()}>
          {saving ? 'Saving…' : 'Save and publish'}
        </button>
      </div>

      {photoEditModal && (
        <PhotoDescModal
          photoUrl={photoEditModal.photoUrl}
          imagePreviewUrl={imagePreviewUrls[photoEditModal.photoUrl]}
          description={photoEditModal.description}
          descriptionTl={photoEditModal.descriptionTl}
          onDescriptionChange={val => setPhotoEditModal(m => m ? { ...m, description: val } : m)}
          onDescriptionTlChange={val => setPhotoEditModal(m => m ? { ...m, descriptionTl: val } : m)}
          onSave={() => {
            updatePhotoDescription(
              photoEditModal.albumId,
              photoEditModal.photoUrl,
              photoEditModal.description,
              photoEditModal.descriptionTl,
            )
            setPhotoEditModal(null)
          }}
          onClose={() => setPhotoEditModal(null)}
        />
      )}

      {previewOpen && (
        <div className="site-content-preview-backdrop" role="presentation" onMouseDown={() => setPreviewOpen(false)}>
          <section
            className="site-content-preview"
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-content-preview-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <header className="site-content-preview-header">
              <h2 id="site-content-preview-title">Page preview</h2>
              <button ref={closePreviewButtonRef} className="btn btn-outline-dark" type="button" onClick={() => setPreviewOpen(false)}>
                Close preview
              </button>
            </header>
            <iframe
              src={publicPagePaths[page]}
              title={`Preview of ${page === 'about' ? 'the About Us page' : page === 'contact' ? 'the Contact page' : page === 'gallery' ? 'the photo gallery' : 'the website home page'}`}
            />
          </section>
        </div>
      )}
    </section>
  )
}
