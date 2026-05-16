import { useState, useEffect, useCallback } from 'react'

export function useTrades(userEmail) {
  const [trades, setTrades]   = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchTrades = useCallback(async () => {
    if (!userEmail) { setTrades([]); setLoading(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/trades?email=${encodeURIComponent(userEmail)}`)
      const data = await res.json()
      setTrades(data.trades || [])
    } catch {
      setTrades([])
    } finally {
      setLoading(false)
    }
  }, [userEmail])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  async function addTrade(trade) {
    const res  = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, trade }),
    })
    const data = await res.json()
    setTrades(prev => [...(prev || []), data.trade])
    return data.trade
  }

  async function addTrades(tradeList) {
    if (!tradeList.length) return 0
    const res  = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, trades: tradeList }),
    })
    const data = await res.json()
    setTrades(prev => [...(prev || []), ...(data.trades || [])])
    return data.count || 0
  }

  async function updateTrade(id, updates) {
    const res  = await fetch(`/api/trades?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, updates }),
    })
    const data = await res.json()
    setTrades(prev => prev.map(t => t.id === id ? { ...t, ...data.trade } : t))
    return data.trade
  }

  async function deleteTrade(id) {
    await fetch(`/api/trades?id=${id}&email=${encodeURIComponent(userEmail)}`, { method: 'DELETE' })
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  async function deleteTradesBySource(source) {
    await fetch(`/api/trades?email=${encodeURIComponent(userEmail)}&source=${encodeURIComponent(source)}`, { method: 'DELETE' })
    setTrades(prev => prev.filter(t => t.source !== source))
  }

  async function clearAllTrades() {
    await fetch(`/api/trades?email=${encodeURIComponent(userEmail)}&clearAll=true`, { method: 'DELETE' })
    setTrades([])
  }

  // Synchronous duplicate check against in-memory trades array
  function checkDuplicate(tradeId, orderNumber, emailId) {
    const arr = trades || []
    if (tradeId)      return arr.some(t => t.tradeId      === tradeId)
    if (orderNumber)  return arr.some(t => t.orderNumber  === orderNumber)
    if (emailId)      return arr.some(t => t.emailId      === emailId)
    return false
  }

  return {
    trades,
    loading,
    refetch: fetchTrades,
    addTrade,
    addTrades,
    updateTrade,
    deleteTrade,
    deleteTradesBySource,
    clearAllTrades,
    checkDuplicate,
  }
}
