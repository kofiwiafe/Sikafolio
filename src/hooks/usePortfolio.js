import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'

// Calculates weighted average cost (WAC) and PnL for each holding.
// Re-runs automatically whenever trades change in IndexedDB.
export function usePortfolio(prices = {}) {
  const trades = useLiveQuery(() => db.trades.toArray(), [])

  if (!trades) return { holdings: [], summary: null, loading: true }

  // Total cash received from all sell trades (gross consideration)
  const stocksSold = trades
    .filter(t => t.orderType === 'Sell')
    .reduce((s, t) => s + (t.grossConsideration || 0), 0)

  // Group by symbol
  const grouped = {}
  for (const t of trades) {
    if (!grouped[t.symbol]) grouped[t.symbol] = { buys: [], sells: [] }
    if (t.orderType === 'Buy') grouped[t.symbol].buys.push(t)
    else grouped[t.symbol].sells.push(t)
  }

  const holdings = Object.entries(grouped)
    .map(([symbol, { buys, sells }]) => {
      const totalBought  = buys.reduce((s, t) => s + t.quantity, 0)
      const totalSold    = sells.reduce((s, t) => s + t.quantity, 0)
      const netShares    = totalBought - totalSold
      if (netShares <= 0) return null

      const totalCost    = buys.reduce((s, t) => s + t.grossConsideration, 0)
      const totalFees    = buys.reduce((s, t) => s + (t.processingFee || 0), 0)
      const avgCost      = totalCost / totalBought                        // WAC per share (gross, for display)
      // Book value includes proportional buy fees so break-even reflects real cash outlay
      const bookValue    = (totalCost + totalFees) * (netShares / totalBought)

      const priceInfo    = prices[symbol] || {}
      const currentPrice = priceInfo.price || 0
      const currentValue = netShares * currentPrice
      const unrealizedPnL = currentValue - bookValue
      const pnlPct       = bookValue > 0 ? (unrealizedPnL / bookValue) * 100 : 0

      // Realized PnL from sells (sell price vs avg cost)
      const realizedPnL  = sells.reduce((s, t) => s + ((t.pricePerShare - avgCost) * t.quantity), 0)

      const allTrades    = [...buys, ...sells].sort(
        (a, b) => new Date(b.executionDate) - new Date(a.executionDate)
      )

      return {
        symbol,
        netShares,
        avgCost,
        bookValue,
        totalFees,
        currentPrice,
        currentValue,
        unrealizedPnL,
        pnlPct,
        realizedPnL,
        change:        priceInfo.change || 0,
        changePercent: priceInfo.changePercent || 0,
        trades:        allTrades,
        buyCount:      buys.length,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.currentValue - a.currentValue)

  const totalCost  = holdings.reduce((s, h) => s + h.bookValue, 0)
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const totalPnL   = totalValue - totalCost
  const totalPct   = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const totalFees  = holdings.reduce((s, h) => s + h.totalFees, 0)

  return {
    holdings,
    loading: false,
    summary: {
      totalValue,
      totalCost,
      totalPnL,
      totalPct,
      totalFees,
      stocksSold,
      positions: holdings.length,
      lastTrade: trades.length > 0
        ? trades.sort((a, b) => new Date(b.executionDate) - new Date(a.executionDate))[0].settlementDate
        : null
    }
  }
}
