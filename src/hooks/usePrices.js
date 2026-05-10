import { useState, useEffect } from 'react'
import { fetchLatestPrices } from '../services/priceService'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

// GSE trading hours: Mon–Fri 10:00–15:00 GMT (same as Ghana time)
function isMarketOpen() {
  const now = new Date()
  const day = now.getUTCDay()        // 0 = Sun, 6 = Sat
  const hour = now.getUTCHours()
  const min  = now.getUTCMinutes()
  const time = hour * 60 + min
  return day >= 1 && day <= 5 && time >= 600 && time < 900 // 10:00–15:00 GMT
}

export function usePrices() {
  const [prices, setPrices]     = useState({})
  const [updatedAt, setUpdated] = useState(null)
  const [loading, setLoading]   = useState(true)

  async function refresh() {
    setLoading(true)
    const p = await fetchLatestPrices()
    setPrices(p)
    setUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    refresh()

    // Poll only during market hours, check every 5 min
    const id = setInterval(() => {
      if (isMarketOpen()) refresh()
    }, POLL_INTERVAL)

    return () => clearInterval(id)
  }, [])

  return { prices, updatedAt, loading, refresh }
}
