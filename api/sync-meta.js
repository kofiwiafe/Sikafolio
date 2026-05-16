import { getDb } from './_db.js'

export default async function handler(req, res) {
  const sql = getDb()

  try {
    if (req.method === 'GET') {
      const { email, key } = req.query
      if (!email || !key) return res.status(400).json({ error: 'email and key required' })
      const rows = await sql`
        SELECT value FROM sync_meta WHERE user_email = ${email} AND key = ${key}
      `
      return res.json({ value: rows[0]?.value ?? null })
    }

    if (req.method === 'PUT') {
      const { email, key, value } = req.body
      if (!email || !key) return res.status(400).json({ error: 'email and key required' })
      await sql`
        INSERT INTO sync_meta (user_email, key, value) VALUES (${email}, ${key}, ${value ?? null})
        ON CONFLICT (user_email, key) DO UPDATE SET value = EXCLUDED.value
      `
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { email, key } = req.query
      if (!email || !key) return res.status(400).json({ error: 'email and key required' })
      await sql`DELETE FROM sync_meta WHERE user_email = ${email} AND key = ${key}`
      return res.json({ ok: true })
    }

    res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    console.error('[sync-meta]', err)
    res.status(500).json({ error: err.message })
  }
}
