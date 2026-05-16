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

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' })

  let body
  try {
    body = await readBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const { title, description } = body
  if (!title) return res.status(400).json({ error: 'title is required' })

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news simplifier for everyday Ghanaians. Given a Ghana business news headline and excerpt, write 1-2 plain sentences explaining what it means for ordinary people — no jargon, no financial terms, just simple clear language a market trader or student would understand. Be direct and specific about real-world impact. Respond with ONLY the simplified explanation. No preamble, no labels.',
          },
          {
            role: 'user',
            content: `Title: ${title}\nContent: ${description || ''}`,
          },
        ],
        max_tokens: 120,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!groqRes.ok) {
      const detail = await groqRes.text()
      return res.status(502).json({ error: `Groq API error ${groqRes.status}`, detail })
    }

    const data = await groqRes.json()
    const summary = data.choices?.[0]?.message?.content?.trim() ?? ''
    res.status(200).json({ summary })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
