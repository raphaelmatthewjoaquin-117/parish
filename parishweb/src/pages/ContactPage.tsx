import { useState } from 'react'
import '../PagesCSS/ContactPage.css'

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement actual form submission
    console.log('Form submitted:', formData)
    setSubmitStatus('success')
    setTimeout(() => {
      setSubmitStatus('idle')
      setFormData({ name: '', email: '', phone: '', message: '' })
    }, 3000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <section className="content-section simple-page container py-5">
      <div className="section-heading mb-5 text-center">
        <p className="eyebrow">Contact Us</p>
        <h2>We would love to hear from you</h2>
        <p className="section-description">
          Get in touch with our parish community. We're here to help answer any questions you may have.
        </p>
      </div>

      <div className="contact-wrapper">
        <div className="contact-info-section">
          <div className="contact-card">
            <div className="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <h3>Visit Us</h3>
            <p className="contact-detail">145 Church Avenue</p>
            <p className="contact-detail">Saint John Parish</p>
            <p className="contact-hours">Open Monday to Saturday</p>
            <p className="contact-hours">9:00 AM - 5:00 PM</p>
          </div>

          <div className="contact-card">
            <div className="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h3>Call Us</h3>
            <p className="contact-detail">
              <a href="tel:+15551234567">(555) 123-4567</a>
            </p>
            <p className="contact-subtext">Monday - Friday</p>
            <p className="contact-subtext">9:00 AM - 4:00 PM</p>
          </div>

          <div className="contact-card">
            <div className="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <h3>Email Us</h3>
            <p className="contact-detail">
              <a href="mailto:office@saintjohnparish.org">office@saintjohnparish.org</a>
            </p>
            <p className="contact-subtext">We respond within 24 hours</p>
          </div>
        </div>

        <div className="contact-form-section">
          <div className="contact-form-wrapper">
            <h3>Send us a message</h3>
            <p className="form-description">Fill out the form below and we'll get back to you as soon as possible.</p>
            
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

              <button className="btn btn-primary btn-submit" type="submit">
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
                  Something went wrong. Please try again.
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
