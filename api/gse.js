export default async function handler(req, res) {
  try {
    const response = await fetch('https://afx.kwayisi.org/gse/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SikaFolio/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) throw new Error(`Upstream ${response.status}`)
    const html = await response.text()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).send(html)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
