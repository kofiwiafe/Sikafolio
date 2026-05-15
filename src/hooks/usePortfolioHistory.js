import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'

// Returns { date, value }[] sorted chronologically.
// Uses real price snapshots when available; falls back to the trade price
// for dates where no snapshot exists (gives an approximation at trade time).
export function usePortfolioHistory() {
  const trades    = useLiveQuery(() => db.trades.orderBy('executionDate').toArray(), [])
  const snapshots = useLiveQuery(() => db.priceSnapshots.orderBy('date').toArray(), [])

  if (!trades || !snapshots) return null

  // Build snapshot lookup: date → { SYMBOL: price }
  const snapshotMap = {}
  for (const s of snapshots) snapshotMap[s.date] = s.values

  // Only use real price snapshot dates — trade-date fallback points use purchase prices
  // which produce wildly wrong period P&L (makes "1 month ago" look like buy-day value).
  const toDate = str => str?.slice(0, 10)
  const snapDates = snapshots.map(s => s.date)

  return snapDates.map(date => {
    // Compute holdings (shares + last trade price) up to this date
    const holdings = {}
    for (const t of trades) {
      const tDate = toDate(t.settlementDate) || toDate(t.executionDate)
      if (!tDate || tDate > date) continue
      if (!holdings[t.symbol]) holdings[t.symbol] = { shares: 0, lastPrice: 0 }
      if (t.orderType === 'Buy') {
        holdings[t.symbol].shares    += t.quantity
        holdings[t.symbol].lastPrice  = t.pricePerShare
      } else {
        holdings[t.symbol].shares -= t.quantity
      }
    }

    // Value = snapshot price (preferred) or last-known trade price
    const snap = snapshotMap[date]
    let value = 0
    for (const [sym, { shares, lastPrice }] of Object.entries(holdings)) {
      if (shares <= 0) continue
      const price = (snap?.[sym]) ?? lastPrice
      value += shares * price
    }

    return { date, value }
  }).filter(p => p.value > 0)
}
