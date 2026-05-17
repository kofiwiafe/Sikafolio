const GSE_URL = 'https://gse.com.gh/financial-statements/'

async function fetchHtml() {
  // Try direct fetch with browser headers
  try {
    const r = await fetch(GSE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) return await r.text()
  } catch {}

  // Fallback: codetabs
  try {
    const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(GSE_URL)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) return await r.text()
  } catch {}

  // Fallback: allorigins
  try {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(GSE_URL)}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (r.ok) {
      const j = await r.json()
      return j.contents || ''
    }
  } catch {}

  return ''
}

function parseHtml(html, filterSymbols) {
  const reports = []
  // Split on each grid item; index 0 is the preamble before the first item
  const blocks = html.split('class="nectar-post-grid-item"')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]

    const linkMatch   = block.match(/class="nectar-post-grid-link"\s+href="([^"]+)"/)
    const tickerMatch = block.match(/class="meta-category"[\s\S]*?<a\s+class="([^"\s]+)/)
    const compMatch   = block.match(/class="meta-category"[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
    const titleMatch  = block.match(/class="post-heading"[\s\S]*?<span>([^<]+)<\/span>/)
    const dateMatch   = block.match(/class="meta-date">([^<]+)<\/span>/)

    const ticker = tickerMatch ? tickerMatch[1].trim().toUpperCase() : null
    const title  = titleMatch  ? titleMatch[1].trim()  : null
    if (!ticker || !title) continue

    if (filterSymbols.length && !filterSymbols.includes(ticker.toLowerCase())) continue

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

  const html = await fetchHtml()
  if (!html) return res.status(502).json({ error: 'Could not fetch GSE financial statements', reports: [] })

  const reports = parseHtml(html, filterSymbols)
  res.json({ reports })
}
