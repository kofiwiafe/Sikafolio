export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'No image provided' })

  const key = process.env.GOOGLE_VISION_KEY
  if (!key) return res.status(500).json({ error: 'Vision API not configured' })

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          }],
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json()
      return res.status(502).json({ error: err.error?.message || 'Vision API error' })
    }

    const data = await response.json()
    const text = data.responses?.[0]?.fullTextAnnotation?.text || ''
    res.status(200).json({ text })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
