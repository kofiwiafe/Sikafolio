const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

function pageUrl(n) {
  return n === 1
    ? 'https://gse.com.gh/financial-statements/'
    : `https://gse.com.gh/financial-statements/page/${n}/`
}

async function fetchPage(n) {
  const url = pageUrl(n)

  // Direct fetch
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
    if (r.ok) return await r.text()
  } catch {}

  // Codetabs fallback (page 1 only — avoid flooding proxy for all pages)
  if (n === 1) {
    try {
      const r = await fetch(
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (r.ok) return await r.text()
    } catch {}

    // Allorigins fallback
    try {
      const r = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (r.ok) {
        const j = await r.json()
        return j.contents || ''
      }
    } catch {}
  }

  return ''
}

function parsePage(html) {
  const reports = []
  const blocks = html.split('class="nectar-post-grid-item"')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]

    const linkMatch   = block.match(/class="nectar-post-grid-link"\s+href="([^"]+)"/)
    const tickerMatch = block.match(/class="meta-category"[\s\S]*?<a\s+class="([^"\s]+)/)
    const compMatch   = block.match(/class="meta-category"[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
    const titleMatch  = block.match(/class="post-heading"[\s\S]*?<span>([^<]+)<\/span>/)
    const dateMatch   = block.match(/class="meta-date">([^<]+)<\/span>/)

    const ticker = tickerMatch ? tickerMatch[1].trim().toUpperCase() : null
    const title  = titleMatch  ? titleMatch[1].trim() : null
    if (!ticker || !title) continue

    const rawDate = dateMatch ? dateMatch[1].trim() : null
    let date = null
    if (rawDate) {
      const p = new Date(rawDate)
      if (!isNaN(p)) date = p.toISOString().slice(0, 10)
    }

    reports.push({
      ticker,
      company: compMatch ? compMatch[1].trim() : null,
      title,
      date,
      rawDate,
      link: linkMatch ? linkMatch[1] : null,
    })
  }

  return reports
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')

  const filterSymbols = (req.query.symbols || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

  // Fetch pages 1–5 in parallel (gse.com.gh only has ~5 pages of financial statements)
  const pages = await Promise.all([1, 2, 3, 4, 5].map(fetchPage))

  // Collect all filings, deduplicate by title
  const seen  = new Set()
  const allReports = []
  for (const html of pages) {
    if (!html) continue
    for (const r of parsePage(html)) {
      if (!seen.has(r.title)) {
        seen.add(r.title)
        allReports.push(r)
      }
    }
  }

  if (!allReports.length) {
    return res.status(502).json({ error: 'Could not fetch GSE financial statements', reports: [] })
  }

  // Keep only the most recent filing per ticker
  const byTicker = {}
  for (const r of allReports) {
    const prev = byTicker[r.ticker]
    if (!prev || (r.date && (!prev.date || r.date > prev.date))) {
      byTicker[r.ticker] = r
    }
  }

  // Filter by held symbols, sort newest first
  let reports = Object.values(byTicker)
  if (filterSymbols.length) {
    reports = reports.filter(r => filterSymbols.includes(r.ticker.toLowerCase()))
  }
  reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  res.json({ reports })
}
