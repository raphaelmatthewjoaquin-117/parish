import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { AboutPage } from './pages/AboutPage'
import { AdminEventsPage } from './pages/AdminEventsPage'
import { ContactPage } from './pages/ContactPage'
import { GalleryPage } from './pages/GalleryPage'
import { HomePage } from './pages/HomePage'
import { NewsPage } from './pages/NewsPage'
import ServicePage from './pages/ServicePage'
import { PrayerRequest } from './pages/PrayerRequest'
import { UnifiedAdminPage } from './pages/UnifiedAdminPage'
import { ResetPasswordPage } from './components/ResetPasswordPage'
import { apiClient } from './api/client'
import { defaultFooterContent, type FooterContent } from './content/siteContent'
import logo from './images/SDP logo.png'
import { observeTranslations, type Language } from './i18n'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'News & Events', to: '/news' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Services', to: '/services' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'Prayer Requests', to: '/prayerRequests' },
]

function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const topbarRef = useRef<HTMLElement>(null)
  const pageShellRef = useRef<HTMLDivElement>(null)
  const [language, setLanguage] = useState<Language>(() => (
    window.localStorage.getItem('site-language') === 'tl' ? 'tl' : 'en'
  ))
  const [footerContent, setFooterContent] = useState<FooterContent>(defaultFooterContent)
  const location = useLocation()
  const isAdminPage = location.pathname.startsWith('/admin')

  const closeMobileMenu = () => setMobileMenuOpen(false)

  useEffect(() => {
    window.localStorage.setItem('site-language', language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    let active = true
    apiClient.siteContent.get<FooterContent>('footer')
      .then(({ content }) => {
        if (active && content) setFooterContent(content)
      })
      .catch((error: unknown) => {
        console.error('Unable to load saved footer content.', error)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const pageShell = pageShellRef.current
    if (!pageShell) return
    return observeTranslations(pageShell, language)
  }, [language])

  // Keep --topbar-h in sync so content below never gets covered when the nav wraps onto two lines
  useEffect(() => {
    const topbar = topbarRef.current
    if (!topbar) return
    const updateHeight = () => {
      document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(topbar)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="page-shell" ref={pageShellRef}>
      <header className="topbar" ref={topbarRef}>
        <div className="header-arch">
          <NavLink className="site-logo" to="/" aria-label="Go to home">
            <img src={logo} alt="SDP" />
          </NavLink>
          <div className="site-brand" aria-hidden="true">
            <span className="site-brand-name">Santo Domingo Parish</span>
            <span className="site-brand-tagline">National Shrine · La Naval de Manila</span>
          </div>
          {!isAdminPage && (
            <nav
              className={`main-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}
              aria-label="Main navigation"
            >
              {navItems.map(({ label, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeMobileMenu}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="header-controls">
            <button
              className="language-toggle"
              type="button"
              data-no-translate
              onClick={() => setLanguage(current => current === 'en' ? 'tl' : 'en')}
              aria-label={language === 'en' ? 'Switch language to Tagalog' : 'Lumipat sa Ingles'}
              title={language === 'en' ? 'Switch language to Tagalog' : 'Lumipat sa Ingles'}
            >
              {language === 'en' ? 'Tagalog' : 'English'}
            </button>
            {isAdminPage && (
              <button
                className="admin-header-signout"
                type="button"
                onClick={() => {
                  window.localStorage.removeItem('adminToken')
                  window.location.reload()
                }}
              >
                Sign out
              </button>
            )}
            {!isAdminPage && (
              <button
                className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage language={language} />} />
          <Route path="/about" element={<AboutPage language={language} />} />
          <Route path="/news" element={<NewsPage language={language} />} />
          <Route path="/gallery" element={<GalleryPage language={language} />} />
          <Route path="/gallery/:albumId" element={<GalleryPage language={language} />} />
          <Route path="/services" element={<ServicePage />} />
          <Route path="/contact" element={<ContactPage language={language} />} />
          <Route path="/admin" element={<UnifiedAdminPage />} />
          <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/events" element={<AdminEventsPage />} />
          <Route path="/prayerRequests" element={<PrayerRequest />} />
        </Routes>
      </main>

      {!isAdminPage && (
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-section">
              <h3>{footerContent.parishTitle}</h3>
              <address>
                {footerContent.addressLines.map((line, index) => <span key={`footer-address-${index}`}>{line}</span>)}
              </address>
            </div>
            <div className="footer-section">
              <h3>{footerContent.scheduleTitle}</h3>
              <ul className="footer-detail-list">
                {footerContent.scheduleLines.map((line, index) => <li key={`footer-schedule-${index}`}>{line}</li>)}
              </ul>
              <h4>{footerContent.officeHoursTitle}</h4>
              <ul className="footer-detail-list">
                {footerContent.officeHoursLines.map((line, index) => <li key={`footer-hours-${index}`}>{line}</li>)}
              </ul>
            </div>
            <div className="footer-section">
              <h3>{footerContent.contactTitle}</h3>
              {footerContent.contactIntro && <p>{footerContent.contactIntro}</p>}
              <ul className="footer-contact-list">
                {footerContent.phoneNumbers.map((phone, index) => (
                  <li key={`footer-phone-${index}`}><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></li>
                ))}
                {footerContent.email && <li><a href={`mailto:${footerContent.email}`}>{footerContent.email}</a></li>}
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-bottom-brand">
              <NavLink to="/" aria-label="Santo Domingo Parish home"><img src={logo} alt="" /></NavLink>
              <p>{footerContent.copyright}</p>
            </div>
            <nav className="footer-quick-links" aria-label={footerContent.quickLinksTitle}>
              <span>{footerContent.quickLinksTitle}</span>
              <ul>
                {footerContent.quickLinks.map((link, index) => (
                  <li key={`footer-link-${index}`}><NavLink to={link.path}>{link.label}</NavLink></li>
                ))}
              </ul>
            </nav>
          </div>
        </footer>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
