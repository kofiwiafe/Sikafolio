const TARGET = 'https://afx.kwayisi.org/gse/'

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

async function fetchWithTimeout(url, opts, ms = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export default async function handler(req, res) {
  let html = null

  // Attempt 1: direct fetch with full browser headers
  try {
    const r = await fetchWithTimeout(TARGET, { headers: BROWSER_HEADERS })
    if (r.ok) html = await r.text()
  } catch { /* fall through */ }

  // Attempt 2: allorigins CORS proxy (different IP than client)
  if (!html) {
    try {
      const r = await fetchWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(TARGET)}`, {}
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
    res.status(200).send(html)
  } else {
    res.status(502).json({ error: 'All upstream fetch attempts failed' })
  }
}
