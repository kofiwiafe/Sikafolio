const FEEDS = [
  { url: 'https://citibusinessnews.com/feed/',    name: 'CitiBusinessNews'  },
  { url: 'https://myjoyonline.com/business/feed/', name: 'Myjoyonline'       },
  { url: 'https://ghanabusinessnews.com/feed/',   name: 'GhanaBusinessNews' },
]

export default async function handler(req, res) {
  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SikaFolio/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) throw new Error(`${feed.name} ${r.status}`)
      const xml = await r.text()
      return parseRSS(xml, feed.name)
    })
  )

  const articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 60)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300')
  res.status(200).json(articles)
}

function parseRSS(xml, source) {
  const items = []
  const rx = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = rx.exec(xml)) !== null) {
    const block = m[1]
    const title       = clean(grab(block, 'title'))
    const link        = clean(grab(block, 'link') || grab(block, 'guid'))
    const description = clean(grab(block, 'description')).slice(0, 400)
    const pubDate     = clean(grab(block, 'pubDate'))
    if (title && link) items.push({ title, link, description, pubDate, source })
  }
  return items
}

function grab(xml, tag) {
  const m = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  )
  return m ? (m[1] ?? m[2] ?? '') : ''
}

function clean(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}
