import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { AboutPage } from './pages/AboutPage'
import { AdminEventsPage } from './pages/AdminEventsPage'
import { ContactPage } from './pages/ContactPage'
import { GalleryPage } from './pages/GalleryPage'
import { HomePage } from './pages/HomePage'
import { NewsPage } from './pages/NewsPage'
import ServicePage from './pages/ServicePage'
import { PrayerRequest } from './pages/PrayerRequest'

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
  return (
    <BrowserRouter>
      <div className="page-shell">
        <header className="topbar">
          <div className="header-arch">
            <nav className="main-nav" aria-label="Main navigation">
              {navItems.map(({ label, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) => (isActive ? 'active' : '')}
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
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/prayerRequests" element={<PrayerRequest />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
