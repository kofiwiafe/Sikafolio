import { useState, useEffect } from 'react'

const SEEN_KEY = 'sikafolio_seen_report_at'

export function useReports(symbols) {
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [hasNew,  setHasNew]    = useState(false)

  // Stable string key — refetch only when the set of symbols changes
  const symbolKey = (symbols || []).slice().sort().join(',')

  useEffect(() => {
    if (!symbolKey) return
    setLoading(true)
    fetch(`/api/reports?symbols=${symbolKey}`)
      .then(r => r.json())
      .then(({ reports = [] }) => {
        setReports(reports)
        const lastSeen = localStorage.getItem(SEEN_KEY) || '1970-01-01'
        setHasNew(reports.some(r => r.date && r.date > lastSeen))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey])

  function markAllSeen() {
    localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10))
    setHasNew(false)
  }

  return { reports, loading, hasNew, markAllSeen }
}
