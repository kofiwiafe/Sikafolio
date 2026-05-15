const PROMPT = `This is an iC Securities Contract Note screenshot — a single-trade confirmation document.

Extract the one trade shown. Return ONLY a valid JSON array with one object, no markdown, no explanation:
[{"orderType":"Buy","symbol":"MTNGH","quantity":130,"grossConsideration":708.50,"fee":15.93,"date":"2026-04-07","settlementDate":"2026-04-10","orderNumber":"260680829","tradeId":"616424"}]

Rules:
- orderType: exactly "Buy" or "Sell" — read from the Description field (e.g. "Buy MTNGH" → "Buy")
- symbol: 2-10 uppercase letters only — read from Description, strip any "GSE " or "GSE." prefix
- quantity: integer from the Quantity field
- grossConsideration: the Amount value in the trade table (NOT Net Consideration)
- fee: the exact "Total Charges & Levies" value — do not estimate or calculate this
- date: YYYY-MM-DD converted from Trade Date (e.g. "7/04/26" → "2026-04-07")
- settlementDate: YYYY-MM-DD converted from Settlement Date, or null if missing
- orderNumber: string from the "Order Number" field in the top details section, or null if unreadable
- tradeId: string from the "Trade ID" field in the top details section (appears directly below or near Order Number), or null if unreadable — this is a short numeric ID, NOT the same as Order Number`

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
