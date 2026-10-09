import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { defaultContactContent, localize, type ContactCard, type ContactContent } from '../content/siteContent'
import type { Language } from '../i18n'
import '../PagesCSS/ContactPage.css'

const cardIcons: Record<ContactCard['type'], React.ReactNode> = {
  visit: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  call: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  email: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
}

export function ContactPage({ language = 'en' }: { language?: Language }) {
  const [content, setContent] = useState<ContactContent>(defaultContactContent)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    apiClient.siteContent.get<ContactContent>('contact')
      .then(({ content: saved }) => { if (active && saved) setContent(saved) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus('sending')
    setErrorMessage('')
    try {
      await apiClient.contactMessages.create(formData)
      setSubmitStatus('success')
      setFormData({ name: '', email: '', phone: '', message: '' })
      setTimeout(() => setSubmitStatus('idle'), 5000)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '')
      setSubmitStatus('error')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const renderCard = (card: ContactCard, index: number) => {
    const lines = card.lines.map((line, lineIndex) => localize(line, card.linesTl?.[lineIndex], language))
    const [first = '', ...rest] = card.lines
    const firstLocalized = lines[0] ?? ''
    const href = card.type === 'call' ? `tel:${first.replace(/[^\d+]/g, '')}` : card.type === 'email' ? `mailto:${first}` : ''
    return (
      <div className="contact-card" key={`${card.type}-${index}`}>
        <div className="contact-icon">{cardIcons[card.type]}</div>
        <h3 data-no-translate>{localize(card.title, card.titleTl, language)}</h3>
        {first && (
          <p className="contact-detail" data-no-translate>
            {href ? <a href={href}>{firstLocalized}</a> : firstLocalized}
          </p>
        )}
        {rest.map((_, restIndex) => (
          <p className={card.type === 'visit' ? 'contact-hours' : 'contact-subtext'} key={restIndex} data-no-translate>
            {lines[restIndex + 1]}
          </p>
        ))}
      </div>
    )
  }

  return (
    <section className="content-section simple-page container py-5">
      <div className="section-heading mb-5 text-center">
        {content.eyebrow && <p className="eyebrow" data-no-translate>{localize(content.eyebrow, content.eyebrowTl, language)}</p>}
        <h2 data-no-translate>{localize(content.heading, content.headingTl, language)}</h2>
        {content.description && (
          <p className="section-description" data-no-translate>{localize(content.description, content.descriptionTl, language)}</p>
        )}
      </div>

      <div className="contact-wrapper">
        <div className="contact-info-section">
          {content.cards.map(renderCard)}
        </div>

        <div className="contact-form-section">
          <div className="contact-form-wrapper">
            <h3 data-no-translate>{localize(content.formTitle ?? '', content.formTitleTl, language)}</h3>
            <p className="form-description" data-no-translate>{localize(content.formDescription ?? '', content.formDescriptionTl, language)}</p>
            
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input 
                  className="form-control" 
                  type="text" 
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe" 
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input 
                  className="form-control" 
                  type="email" 
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com" 
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input 
                  className="form-control" 
                  type="tel" 
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea 
                  className="form-control" 
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="How can we help you?" 
                  rows={5}
                  required
                />
              </div>

              <button className="btn btn-primary btn-submit" type="submit" disabled={submitStatus === 'sending'}>
                <span>Send Message</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" x2="11" y1="2" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>

              {submitStatus === 'success' && (
                <div className="alert alert-success">
                  Thank you for your message! We'll get back to you soon.
                </div>
              )}
              {submitStatus === 'error' && (
                <div className="alert alert-error">
                  {errorMessage || 'Something went wrong. Please try again.'}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
