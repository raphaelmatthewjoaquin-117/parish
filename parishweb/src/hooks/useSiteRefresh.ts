import { useEffect, useState } from 'react'

const SITE_REFRESH_INTERVAL_MS = 30_000

export function useSiteRefresh(enabled = true): number {
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRefreshKey(key => key + 1)
    }, SITE_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [enabled])

  return refreshKey
}
