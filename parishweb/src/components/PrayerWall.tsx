import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../api/client'
import { PrayerDetailsModal } from './PrayerDetailsModal'
import { getPrayerCategoryColor, type PrayerDetails } from '../utils/prayer'

const CATEGORIES = [
  { value: 'all', label: 'All Prayers' },
  { value: 'healing', label: 'Healing' },
  { value: 'thanksgiving', label: 'Thanksgiving' },
  { value: 'guidance', label: 'Guidance' },
  { value: 'family', label: 'Family' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'other', label: 'Other' },
]

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const truncateText = (text: string, maxLength: number = 120): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function PrayerWall() {
  const [prayers, setPrayers] = useState<PrayerDetails[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPrayer, setSelectedPrayer] = useState<PrayerDetails | null>(null)

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
                      style={{ backgroundColor: getPrayerCategoryColor(prayer.category) }}
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

      {selectedPrayer && <PrayerDetailsModal prayer={selectedPrayer} onClose={() => setSelectedPrayer(null)} />}
    </>
  )
}
