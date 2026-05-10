// Free GSE price feed via allorigins CORS proxy → afx.kwayisi.org
// Falls back to cached Dexie prices when offline or fetch fails.

import { db } from './db'

const GSE_URL = 'https://afx.kwayisi.org/gse/'
const PROXY   = 'https://api.allorigins.win/get?url='

export async function fetchLatestPrices() {
  try {
    const res  = await fetch(`${PROXY}${encodeURIComponent(GSE_URL)}`)
    const data = await res.json()
    const prices = parseGSETable(data.contents)

    // Persist to Dexie so offline mode works
    for (const [symbol, info] of Object.entries(prices)) {
      await db.prices.put({ symbol, ...info, updatedAt: new Date().toISOString() })
    }

    return prices
  } catch (err) {
    console.warn('Live price fetch failed, using cached prices', err)
    const cached = await db.prices.toArray()
    return Object.fromEntries(cached.map(p => [p.symbol, p]))
  }
}

function parseGSETable(html) {
  if (!html) return {}
  const parser = new DOMParser()
  const doc    = parser.parseFromString(html, 'text/html')
  const prices = {}

  // kwayisi.org table: symbol | name | price | change | %change | volume
  const rows = doc.querySelectorAll('table tbody tr, table tr')
  rows.forEach(row => {
    const cells = [...row.querySelectorAll('td')]
    if (cells.length < 3) return

    const symbol        = cells[0]?.textContent?.trim()?.toUpperCase()
    const price         = parseFloat(cells[2]?.textContent?.replace(/[^0-9.]/g, ''))
    const change        = parseFloat(cells[3]?.textContent?.replace(/[^0-9.-]/g, '')) || 0
    const changePercent = parseFloat(cells[4]?.textContent?.replace(/[^0-9.-]/g, '')) || 0

    if (symbol && !isNaN(price)) {
      prices[symbol] = { price, change, changePercent }
    }
  })

  return prices
}
