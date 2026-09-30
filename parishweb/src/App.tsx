import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
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
import logo from './images/SDP logo.png'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'News & Events', to: '/news' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Services', to: '/services' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'Prayer Requests', to: '/prayerRequests' },
]

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)
  return (
    <BrowserRouter>
      <div className="page-shell">
        <header className="topbar">
          <div className="header-arch">
            <NavLink className="site-logo" to="/" aria-label="Go to home">
              <img src={logo} alt="SDP" />
            </NavLink>
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
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/services" element={<ServicePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/admin" element={<UnifiedAdminPage />} />
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/prayerRequests" element={<PrayerRequest />} />
          </Routes>
        </main>

        <footer className="footer">
          <div className="footer-content">
            <div className="footer-section">
              <h3>Parish Information</h3>
              <p>145 Church Avenue<br />Saint John Parish<br />Phone: (555) 123-4567<br />Email: office@saintjohnparish.org</p>
            </div>
            <div className="footer-section">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/about">About Us</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="/prayerRequests">Prayer Requests</a></li>
                <li><a href="/services#certificate">Certificate Request</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h3>Service Times</h3>
              <p>Saturday: 5:30 PM<br />Sunday: 8:00 AM<br />Sunday: 10:30 AM<br />Weekday: 7:00 AM</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Saint John Parish. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
