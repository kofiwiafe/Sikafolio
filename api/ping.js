import { getDb } from './_db.js'

export default async function handler(req, res) {
  try {
    const sql = getDb()
    await sql`SELECT 1`
    res.json({ ok: true, ts: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
