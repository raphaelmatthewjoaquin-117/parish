import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../api/client'

interface Prayer {
  id: number
  name: string
  category: string
  request: string
  createdAt: string
}

const CATEGORIES = [
  { value: 'all', label: 'All Prayers' },
  { value: 'healing', label: 'Healing' },
  { value: 'thanksgiving', label: 'Thanksgiving' },
  { value: 'guidance', label: 'Guidance' },
  { value: 'family', label: 'Family' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'other', label: 'Other' },
]

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'healing':
      return '#4caf50'
    case 'thanksgiving':
      return '#2196f3'
    case 'guidance':
      return '#ff9800'
    case 'family':
      return '#9c27b0'
    case 'deceased':
      return '#757575'
    default:
      return '#d4af37'
  }
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const truncateText = (text: string, maxLength: number = 120): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function PrayerWall() {
  const [prayers, setPrayers] = useState<Prayer[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPrayer, setSelectedPrayer] = useState<Prayer | null>(null)

  useEffect(() => {
    const fetchPrayers = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`${API_BASE_URL}/api/prayers`)
        if (!response.ok) throw new Error('Failed to load prayers')
        const data = await response.json()
        setPrayers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load prayers')
        setPrayers([])
      } finally {
        setLoading(false)
      }
    }

    fetchPrayers()
  }, [])

  const filteredPrayers = selectedCategory === 'all'
    ? prayers
    : prayers.filter(prayer => prayer.category === selectedCategory)

  return (
    <>
      <div className="prayer-wall card border-0 shadow-sm p-4">
        <div className="prayer-wall-header">
          <h2>Community Prayer Wall</h2>
          <p className="prayer-wall-subtitle">
            {filteredPrayers.length} {filteredPrayers.length === 1 ? 'prayer' : 'prayers'}
          </p>
        </div>

        <div className="prayer-wall-filters d-flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`filter-btn btn btn-sm ${selectedCategory === cat.value ? 'active btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setSelectedCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="prayer-wall-content prayer-wall-scrollable">
          {loading && (
            <div className="prayer-wall-state">
              <div className="spinner"></div>
              <p>Loading prayers...</p>
            </div>
          )}

          {error && (
            <div className="prayer-wall-state error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && filteredPrayers.length === 0 && (
            <div className="prayer-wall-state">
              <p>No prayers yet. Be the first to share your intention.</p>
            </div>
          )}

          {!loading && !error && filteredPrayers.length > 0 && (
            <div className="prayer-cards">
              {filteredPrayers.map(prayer => (
                <div
                  key={prayer.id}
                  className="prayer-card"
                  onClick={() => setSelectedPrayer(prayer)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="prayer-card-header">
                    <span
                      className="prayer-card-category"
                      style={{ backgroundColor: getCategoryColor(prayer.category) }}
                    >
                      {prayer.category}
                    </span>
                    <span className="prayer-card-date">{formatDate(prayer.createdAt)}</span>
                  </div>

                  <div className="prayer-card-body">
                    <p className="prayer-card-text">
                      {truncateText(prayer.request)}
                    </p>
                  </div>

                  <div className="prayer-card-footer">
                    <span className="prayer-card-name">{prayer.name}</span>
                    <span className="prayer-card-expand">View →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPrayer && (
        <div className="prayer-modal-overlay" onClick={() => setSelectedPrayer(null)}>
          <div className="prayer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="prayer-modal-header">
              <div>
                <span
                  className="prayer-modal-category"
                  style={{ backgroundColor: getCategoryColor(selectedPrayer.category) }}
                >
                  {selectedPrayer.category}
                </span>
                <span className="prayer-modal-date">{formatDate(selectedPrayer.createdAt)}</span>
              </div>
              <button
                className="prayer-modal-close"
                onClick={() => setSelectedPrayer(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="prayer-modal-body">
              <p className="prayer-modal-text">{selectedPrayer.request}</p>
            </div>
            <div className="prayer-modal-footer">
              <span className="prayer-modal-name">— {selectedPrayer.name}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
