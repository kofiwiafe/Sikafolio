// Pure computation — takes trades array + prices map, no DB access.
export function usePortfolio(trades, prices = {}) {
  if (!trades) return { holdings: [], summary: null, loading: true }

  const stocksSold = trades
    .filter(t => t.orderType === 'Sell')
    .reduce((s, t) => s + (t.grossConsideration || 0), 0)

  const grouped = {}
  for (const t of trades) {
    if (!grouped[t.symbol]) grouped[t.symbol] = { buys: [], sells: [] }
    if (t.orderType === 'Buy') grouped[t.symbol].buys.push(t)
    else grouped[t.symbol].sells.push(t)
  }

  const holdings = Object.entries(grouped)
    .map(([symbol, { buys, sells }]) => {
      const totalBought = buys.reduce((s, t) => s + t.quantity, 0)
      const totalSold   = sells.reduce((s, t) => s + t.quantity, 0)
      const netShares   = totalBought - totalSold
      if (netShares <= 0) return null

      const totalCost  = buys.reduce((s, t) => s + t.grossConsideration, 0)
      const totalFees  = buys.reduce((s, t) => s + (t.processingFee || 0), 0)
      const avgCost    = totalCost / totalBought
      const bookValue  = (totalCost + totalFees) * (netShares / totalBought)

      const priceInfo   = prices[symbol] || {}
      const livePrice   = priceInfo.price > 0 ? priceInfo.price : 0
      const lastBuyPrice = buys.reduce((last, t) =>
        new Date(t.executionDate) > new Date(last.executionDate) ? t : last, buys[0]
      ).pricePerShare || 0
      const currentPrice  = livePrice || lastBuyPrice
      const hasLivePrice  = livePrice > 0
      const currentValue  = netShares * currentPrice
      const unrealizedPnL = currentValue - bookValue
      const pnlPct        = bookValue > 0 ? (unrealizedPnL / bookValue) * 100 : 0

      const realizedPnL = sells.reduce((s, t) => s + ((t.pricePerShare - avgCost) * t.quantity), 0)

      const allTrades = [...buys, ...sells].sort(
        (a, b) => new Date(b.executionDate) - new Date(a.executionDate)
      )

      return {
        symbol,
        netShares,
        avgCost,
        bookValue,
        totalFees,
        currentPrice,
        hasLivePrice,
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
        : null,
    },
  }
}
