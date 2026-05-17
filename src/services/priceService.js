import { db } from './db'

const GSE_URL = 'https://afx.kwayisi.org/gse/'
const CORS_PROXIES = [
  `https://api.allorigins.win/get?url=${encodeURIComponent(GSE_URL)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(GSE_URL)}`,
]

export async function fetchLatestPrices() {
  // Try our own Vercel proxy first (returns JSON from gse.com.gh or HTML from afx)
  try {
    const res = await fetch('/api/gse')
    if (res.ok) {
      const text = await res.text()
      let prices = {}
      try {
        const json = JSON.parse(text)
        if (json.prices && Object.keys(json.prices).length > 0) prices = json.prices
      } catch {
        prices = parseGSETable(text)
      }
      if (Object.keys(prices).length > 0) {
        await persistPrices(prices)
        return prices
      }
    }
  } catch { /* fall through */ }

  // Client-side CORS proxy fallbacks
  for (const proxyUrl of CORS_PROXIES) {
    try {
      const res = await fetch(proxyUrl)
      if (!res.ok) continue
      const text = await res.text()
      // allorigins wraps response in JSON; codetabs returns raw HTML
      let html = text
      try { html = JSON.parse(text)?.contents ?? text } catch { /* raw html */ }
      const prices = parseGSETable(html)
      if (Object.keys(prices).length > 0) {
        await persistPrices(prices)
        return prices
      }
    } catch { /* try next */ }
  }

  // Last resort: Dexie cache (filter out stale 0-price entries)
  const cached = await db.prices.toArray()
  return Object.fromEntries(cached.filter(p => p.price > 0).map(p => [p.symbol, p]))
}

async function persistPrices(prices) {
  for (const [symbol, info] of Object.entries(prices)) {
    await db.prices.put({ symbol, ...info, updatedAt: new Date().toISOString() })
  }
}

// Safely parse the first number (including leading minus) from arbitrary text
function parseNum(text) {
  if (!text) return 0
  const m = String(text).trim().match(/-?[\d,]+\.?\d*/)
  return m ? parseFloat(m[0].replace(/,/g, '')) : 0
}

function parseGSETable(html) {
  if (!html) return {}
  const parser = new DOMParser()
  const doc    = parser.parseFromString(html, 'text/html')
  const prices = {}

  // afx.kwayisi.org main table columns: ticker (link) | name (link) | volume | price | change
  const rows = doc.querySelectorAll('table tbody tr, table tr')
  rows.forEach(row => {
    const cells = [...row.querySelectorAll('td')]
    if (cells.length < 4) return

    const link   = cells[0]?.querySelector('a')
    const symbol = (link?.textContent ?? cells[0]?.textContent ?? '').trim().toUpperCase()
    const name   = cells[1]?.textContent?.trim() || link?.getAttribute('title') || ''
    const volume = parseInt(String(cells[2]?.textContent || '').replace(/\D/g, '') || '0', 10)
    const price  = parseNum(cells[3]?.textContent)
    const change = parseNum(cells[4]?.textContent)
    const prev   = price - change
    const changePercent = prev !== 0 ? (change / prev) * 100 : 0

    // Only accept valid GSE tickers (2–10 uppercase letters, no digits)
    if (!/^[A-Z]{2,10}$/.test(symbol)) return
    if (!isNaN(price) && price > 0) {
      prices[symbol] = { name, price, change, changePercent, volume }
    }
  })

  return prices
}
