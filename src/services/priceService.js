import { db } from './db'

const GSE_FALLBACK_PROXY = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://afx.kwayisi.org/gse/')

export async function fetchLatestPrices() {
  // Try our own proxy route first (works in Vercel prod; Vite dev proxies it too)
  try {
    const res = await fetch('/api/gse')
    if (res.ok) {
      const html = await res.text()
      const prices = parseGSETable(html)
      if (Object.keys(prices).length > 0) {
        await persistPrices(prices)
        return prices
      }
    }
  } catch { /* fall through */ }

  // Fall back to allorigins CORS proxy
  try {
    const res  = await fetch(GSE_FALLBACK_PROXY)
    const data = await res.json()
    const prices = parseGSETable(data.contents)
    if (Object.keys(prices).length > 0) {
      await persistPrices(prices)
      return prices
    }
  } catch { /* fall through */ }

  // Last resort: Dexie cache
  console.warn('All price fetches failed — serving cached data')
  const cached = await db.prices.toArray()
  return Object.fromEntries(cached.map(p => [p.symbol, p]))
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

  // kwayisi.org table columns: symbol | name | price | change | %change | volume
  const rows = doc.querySelectorAll('table tbody tr, table tr')
  rows.forEach(row => {
    const cells = [...row.querySelectorAll('td')]
    if (cells.length < 3) return

    const symbol        = cells[0]?.textContent?.trim()?.toUpperCase()
    const name          = cells[1]?.textContent?.trim() || ''
    const price         = parseNum(cells[2]?.textContent)
    const change        = parseNum(cells[3]?.textContent)
    const changePercent = parseNum(cells[4]?.textContent)
    const volume        = parseInt(String(cells[5]?.textContent || '').replace(/\D/g, '') || '0', 10)

    // Only accept valid GSE tickers (2–10 uppercase letters, no digits)
    if (!/^[A-Z]{2,10}$/.test(symbol)) return
    if (!isNaN(price) && price > 0) {
      prices[symbol] = { name, price, change, changePercent, volume }
    }
  })

  return prices
}
