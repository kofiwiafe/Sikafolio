const PROMPT = `This is a screenshot from the iC Wealth mobile app (a Ghana stock broker).
It shows an Order History screen with trade cards on a dark glass UI.

Extract ALL trade cards visible. Each card has a large bold header like "Buy 41 MTNGH" or "Sell 30 SIC" (order type, quantity, stock symbol).

Return ONLY a valid JSON array, no markdown, no explanation:
[{"orderType":"Buy","symbol":"MTNGH","quantity":41,"grossConsideration":278.80,"date":"2026-05-06","orderNumber":"123456789"}]

Rules:
- orderType: exactly "Buy" or "Sell"
- symbol: 2-10 uppercase letters only — strip any "GSE ", "GSE." prefix
- quantity: integer number of shares
- grossConsideration: the number shown next to "Estimated Value" (GHS amount)
- date: YYYY-MM-DD — convert ordinal dates like "6th May 2026" → "2026-05-06"
- orderNumber: 6–9 digit string from the "Order number" field, or null if unreadable
- Include ALL trade cards shown, even partial ones at the edge of the screen`

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(raw)) } catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' })

  let body
  try {
    body = await readBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const { image, mimeType = 'image/jpeg' } = body
  if (!image) return res.status(400).json({ error: 'No image provided' })

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: image } },
              { text: PROMPT },
            ],
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    )

    if (!geminiRes.ok) {
      const detail = await geminiRes.text()
      return res.status(502).json({ error: `Gemini API error ${geminiRes.status}`, detail })
    }

    const data = await geminiRes.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'

    let trades
    try {
      trades = JSON.parse(text)
    } catch {
      const m = text.match(/\[[\s\S]*\]/)
      trades = m ? JSON.parse(m[0]) : []
    }

    res.status(200).json({ trades: Array.isArray(trades) ? trades : [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
