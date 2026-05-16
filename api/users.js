import { getDb } from './_db.js'

function toUser(row) {
  return {
    id:       row.id,
    email:    row.email,
    name:     row.name,
    passcode: row.passcode,
    avatar:   row.avatar,
    provider: row.provider,
  }
}

export default async function handler(req, res) {
  const sql = getDb()

  try {
    if (req.method === 'GET') {
      const { email } = req.query
      if (!email) return res.status(400).json({ error: 'email required' })
      const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
      if (!rows.length) return res.status(404).json({ error: 'not found' })
      return res.json({ user: toUser(rows[0]) })
    }

    if (req.method === 'POST') {
      const { email, name, passcode, avatar, provider } = req.body
      if (!email) return res.status(400).json({ error: 'email required' })
      const rows = await sql`
        INSERT INTO users (email, name, passcode, avatar, provider)
        VALUES (${email}, ${name ?? null}, ${passcode ?? null}, ${avatar ?? null}, ${provider ?? 'local'})
        ON CONFLICT (email) DO UPDATE SET
          name   = COALESCE(EXCLUDED.name,   users.name),
          avatar = COALESCE(EXCLUDED.avatar, users.avatar)
        RETURNING *
      `
      return res.json({ user: toUser(rows[0]) })
    }

    res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    console.error('[users]', err)
    res.status(500).json({ error: err.message })
  }
}
