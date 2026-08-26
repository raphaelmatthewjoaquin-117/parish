import { useState } from 'react'
import '../PagesCSS/PrayerRequest.css'

type PrayerCategory = 'healing' | 'thanksgiving' | 'guidance' | 'family' | 'deceased' | 'other'

interface PrayerFormData {
  name: string
  email: string
  phone: string
  category: PrayerCategory
  request: string
  anonymous: boolean
  shareWithCommunity: boolean
}

interface FormErrors {
  name?: string
  email?: string
  request?: string
}

const CATEGORIES: { value: PrayerCategory; label: string }[] = [
  { value: 'healing', label: '🙏 Healing & Health' },
  { value: 'thanksgiving', label: '🙌 Thanksgiving & Praise' },
  { value: 'guidance', label: '🕊️ Guidance & Wisdom' },
  { value: 'family', label: '👨‍👩‍👧‍👦 Family & Relationships' },
  { value: 'deceased', label: '✝️ For the Deceased' },
  { value: 'other', label: '📝 Other Intentions' },
]

const INITIAL_FORM: PrayerFormData = {
  name: '',
  email: '',
  phone: '',
  category: 'healing',
  request: '',
  anonymous: false,
  shareWithCommunity: false,
}

export function PrayerRequest() {
  const [form, setForm] = useState<PrayerFormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!form.name.trim()) newErrors.name = 'Please enter your name'
    if (!form.email.trim()) newErrors.email = 'Please enter your email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    if (!form.request.trim()) newErrors.request = 'Please write your prayer request'
    else if (form.request.trim().length < 10) {
      newErrors.request = 'Prayer request must be at least 10 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSubmitting(false)
    setSubmitted(true)
    setForm(INITIAL_FORM)
  }

  const handleReset = () => {
    setForm(INITIAL_FORM)
    setErrors({})
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <section className="prayer-request success-state" id="prayer-request">
        <div className="success-container">
          <div className="success-icon" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <h2>Your Prayer Has Been Received</h2>
          <p className="success-message">
            Thank you for sharing your prayer intention with us. Our prayer team will lift up your request during our daily prayers and Masses.
          </p>
          <p className="success-note">
            {form.anonymous ? 'Your request will remain completely anonymous.' : 'We may contact you at ' + form.email + ' if we need any clarification.'}
          </p>
          <button type="button" className="primary-btn" onClick={handleReset}>
            Submit Another Prayer
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="prayer-request" id="prayer-request">
      <div className="prayer-layout">
        <div className="prayer-info">
          <p className="eyebrow">Prayer Ministry</p>
          <h1>Share Your Prayer Request</h1>
          <p className="lead">
            "Whatever you ask for in prayer with faith, you will receive." — Matthew 21:22
          </p>
          <p className="description">
            Our parish community believes in the power of prayer. Whether you're seeking healing, guidance, giving thanks,
            or praying for a loved one, our dedicated prayer team is here to lift up your intentions before the Lord.
          </p>

          <div className="prayer-features">
            <div className="feature">
              <span className="feature-icon" aria-hidden="true">🕊️</span>
              <div>
                <strong>Confidential</strong>
                <span>Your requests are treated with utmost confidentiality</span>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon" aria-hidden="true">🙏</span>
              <div>
                <strong>Prayed Over</strong>
                <span>Our prayer team prays for each request daily</span>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon" aria-hidden="true">✝️</span>
              <div>
                <strong>Included in Mass</strong>
                <span>Intentions offered during Holy Mass upon request</span>
              </div>
            </div>
          </div>

          <div className="prayer-verse">
            <blockquote>
              <p>"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God."</p>
              <cite>— Philippians 4:6</cite>
            </blockquote>
          </div>
        </div>

        <div className="prayer-form-container">
          <form className="prayer-form" onSubmit={handleSubmit} noValidate>
            <div className="form-header">
              <p className="eyebrow">Submit Request</p>
              <h2>Prayer Request Form</h2>
            </div>


            <div className="form-group">
              <label htmlFor="category">Prayer Category <span className="required" aria-hidden="true">*</span></label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
                disabled={submitting}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="request">Your Prayer Request <span className="required" aria-hidden="true">*</span></label>
              <textarea
                id="request"
                name="request"
                value={form.request}
                onChange={handleChange}
                rows={6}
                placeholder="Please share your prayer intention here...&#10;&#10;Example: Please pray for my mother's recovery from surgery, for guidance in my career decisions, or in thanksgiving for a blessing received."
                aria-invalid={!!errors.request}
                aria-describedby={errors.request ? 'request-error' : 'request-hint'}
                disabled={submitting}
              />
              {errors.request ? (
                <span id="request-error" className="error-message" role="alert">{errors.request}</span>
              ) : (
                <span id="request-hint" className="hint">Minimum 10 characters. You may include names (with permission) and specific details.</span>
              )}
            </div>

             <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Your Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="(OPTIONAL)"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  disabled={submitting}
                />
                {errors.name && <span id="name-error" className="error-message" role="alert">{errors.name}</span>}
              </div>
            </div>

            <fieldset className="checkbox-group">
              <legend>Privacy Options</legend>
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  id="anonymous"
                  name="anonymous"
                  checked={form.anonymous}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <label htmlFor="anonymous">
                  <strong>Keep my request anonymous</strong>
                  <span>My name will not be shared with the prayer team or published anywhere</span>
                </label>
              </div>
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  id="shareWithCommunity"
                  name="shareWithCommunity"
                  checked={form.shareWithCommunity}
                  onChange={handleChange}
                  disabled={submitting || form.anonymous}
                />
                <label htmlFor="shareWithCommunity">
                  <strong>Share with parish community</strong>
                  <span>Allow my request (without personal details) to be included in the weekly bulletin/prayer list</span>
                </label>
              </div>
            </fieldset>

            <div className="form-actions">
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    Submitting...
                  </>
                ) : (
                  'Submit Prayer Request'
                )}
              </button>
              <button type="button" className="secondary-btn" onClick={handleReset} disabled={submitting}>
                Clear Form
              </button>
            </div>

            <p className="form-footer">
              By submitting, you agree to our <a href="/privacy">Privacy Policy</a>.
              Prayer requests are reviewed by our pastoral team and may be included in Mass intentions
              at the discretion of the celebrant.
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}