import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, getMediaUrl } from '../api/client'
import { defaultAboutContent, localize, type AboutContent } from '../content/siteContent'
import type { Language } from '../i18n'
import '../PagesCSS/AboutPage.css'

// Saved content from before the timeline/intro fields existed falls back to the defaults for them.
const withNewFieldDefaults = (saved: AboutContent): AboutContent => ({
  ...saved,
  intro: saved.intro ?? defaultAboutContent.intro,
  timeline: saved.timeline ?? defaultAboutContent.timeline,
})

const getImageUrl = getMediaUrl

export function AboutPage({ language = 'en' }: { language?: Language }) {
  const [content, setContent] = useState(defaultAboutContent)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    apiClient.siteContent.get<AboutContent>('about')
      .then(({ content: saved }) => {
        if (saved) setContent(withNewFieldDefaults(saved))
      })
      .catch(() => setLoadError(true))
  }, [])

  const timeline = content.timeline ?? []
  const intro = content.intro?.trim() ? localize(content.intro, content.introTl, language) : ''
  const quote = content.quote?.text?.trim() ? content.quote : null

  return (
    <div className="about-page">
      <header
        className="about-hero"
        style={content.heroImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.65)), url("${getImageUrl(content.heroImage)}")` } : undefined}
      >
        <div className="container">
          <p className="eyebrow">About Us</p>
          <h2 data-no-translate>{localize(content.heading, content.headingTl, language)}</h2>
          {intro && <p className="about-hero-intro" data-no-translate>{intro}</p>}
        </div>
      </header>

      <section className="content-section container py-5">
        {loadError && <p className="error-message" role="status">Unable to load updated About Us content. Showing the default content.</p>}

        <div className="page-layout row g-5 align-items-start">
          <div className={`text-block ${timeline.length ? 'col-lg-7' : 'col-lg-10'}`}>
            {content.paragraphs.map((paragraph, index) => (
              <p key={index} className={index === 0 ? 'about-lead' : undefined} data-no-translate>
                {localize(paragraph, content.paragraphsTl?.[index], language)}
              </p>
            ))}
          </div>

          {timeline.length > 0 && (
            <aside className="col-lg-5" aria-label="Parish timeline">
              <ol className="about-timeline">
                {timeline.map((item, index) => (
                  <li key={`${item.year}-${index}`}>
                    <span className="about-timeline-year">{item.year}</span>
                    <h3 data-no-translate>{localize(item.title, item.titleTl, language)}</h3>
                    <p data-no-translate>{localize(item.description, item.descriptionTl, language)}</p>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </section>

      {content.stats.length > 0 && (
        <section className="about-stats" aria-label="Parish at a glance">
          <div className="container">
            {content.stats.map((stat, index) => (
              <div key={`${stat.label}-${index}`}>
                <strong>{stat.value}</strong>
                <span data-no-translate>{localize(stat.label, stat.labelTl, language)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {quote && (
        <section className="container py-5">
          <blockquote className="about-quote">
            <p data-no-translate>{localize(quote.text, quote.textTl, language)}</p>
            {quote.attribution && <footer>{quote.attribution}</footer>}
          </blockquote>
        </section>
      )}

      <section className="about-cta container">
        <h3>Come and pray with us</h3>
        <div>
          <Link className="btn btn-dark" to="/">Mass schedule</Link>
          <Link className="btn btn-outline-dark" to="/contact">Contact the parish</Link>
        </div>
      </section>
    </div>
  )
}
