const AFX_TARGET = 'https://afx.kwayisi.org/gse/'
const GSE_AJAX_URL = 'https://gse.com.gh/wp-admin/admin-ajax.php?action=get_wdtable&table_id=39'
const GSE_PAGE_URL = 'https://gse.com.gh/trading-and-data/'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

function fetchWithTimeout(url, opts, ms = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id))
}

function parseFloat_(s) {
  const v = parseFloat(String(s || '').replace(/,/g, ''))
  return isNaN(v) ? 0 : v
}

function parseInt_(s) {
  const v = parseInt(String(s || '').replace(/,/g, ''), 10)
  return isNaN(v) ? 0 : v
}

async function fetchGseComGh() {
  // Fetch page to get a fresh nonce
  let nonce = ''
  try {
    const pageRes = await fetchWithTimeout(GSE_PAGE_URL, { headers: BROWSER_HEADERS }, 10000)
    if (pageRes.ok) {
      const html = await pageRes.text()
      const m = html.match(/id="wdtNonceFrontendEdit_39"[^>]*value="([^"]+)"/)
      if (m) nonce = m[1]
    }
  } catch { /* proceed without nonce */ }

  const body = new URLSearchParams({
    draw: '1',
    start: '0',
    length: '200',
    'order[0][column]': '1',
    'order[0][dir]': 'desc',
    'search[value]': '',
    'search[regex]': 'false',
  })
  if (nonce) body.set('wdtNonce', nonce)

  const res = await fetchWithTimeout(GSE_AJAX_URL, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': GSE_PAGE_URL,
    },
    body: body.toString(),
  }, 15000)

  if (!res.ok) return null
  const json = await res.json()

  // DataTables row: [id, date(DD/MM/YYYY), symbol, yearHigh, yearLow,
  //                  prevClose, open, lastTxn, closingPrice, priceChange,
  //                  bidPrice, offerPrice, sharesTraded, valueTrded]
  const prices = {}
  const seen = new Set()

  for (const row of (json.data || [])) {
    // Strip suspended-stock marker asterisks (e.g. **ALW**)
    const symbol = String(row[2] || '').replace(/\*/g, '').trim().toUpperCase()
    if (!/^[A-Z]{2,10}$/.test(symbol)) continue
    if (seen.has(symbol)) continue // data sorted date DESC — first hit is latest
    seen.add(symbol)

    const price     = parseFloat_(row[8])
    const prevClose = parseFloat_(row[5])
    const change    = parseFloat_(row[9])
    const volume    = parseInt_(row[12])
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    if (price > 0) {
      prices[symbol] = { price, change, changePercent, volume }
    }
  }

  return Object.keys(prices).length > 0 ? prices : null
}

export default async function handler(req, res) {
  // Primary: gse.com.gh (official GSE source)
  try {
    const prices = await fetchGseComGh()
    if (prices) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
      return res.status(200).json({ prices })
    }
  } catch { /* fall through */ }

  // Fallback: afx.kwayisi.org (returns raw HTML for client-side parsing)
  let html = null
  try {
    const r = await fetchWithTimeout(AFX_TARGET, { headers: BROWSER_HEADERS })
    if (r.ok) html = await r.text()
  } catch { /* fall through */ }

  if (!html) {
    try {
      const r = await fetchWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(AFX_TARGET)}`, {}
      )
      if (r.ok) {
        const data = await r.json()
        if (data?.contents) html = data.contents
      }
    } catch { /* fall through */ }
  }

  if (html) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    return res.status(200).send(html)
  }

  res.status(502).json({ error: 'All upstream fetch attempts failed' })
}
