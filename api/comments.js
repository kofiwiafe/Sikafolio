import { getDb } from './_db.js'

const BANNED = [
  'guaranteed return', 'guaranteed profit', 'sure profit', 'sure gain',
  'insider tip', 'insider info', 'inside info', 'inside information',
  'risk free', 'risk-free', 'no risk',
  'pump and dump', 'pump & dump',
  '100% profit', '100% return', '100% gain',
  'hot tip', 'buy now', 'sell now', 'get in now',
]

function containsBanned(text) {
  const lower = text.toLowerCase()
  return BANNED.some(phrase => lower.includes(phrase))
}

function toComment(row) {
  return {
    id:          row.id,
    symbol:      row.symbol,
    userEmail:   row.user_email,
    displayName: row.display_name,
    body:        row.body,
    parentId:    row.parent_id,
    isHolder:    row.is_holder,
    createdAt:   row.created_at,
    replies:     [],
  }
}

export default async function handler(req, res) {
  const sql = getDb()

  // GET ?symbol= — fetch all comments for a stock
  if (req.method === 'GET') {
    const { symbol } = req.query
    if (!symbol) return res.status(400).json({ error: 'symbol required' })

    const rows = await sql`
      SELECT * FROM comments
      WHERE symbol = ${symbol}
        AND deleted_at IS NULL
        AND flagged = FALSE
      ORDER BY created_at ASC
    `

    const byId = {}
    const topLevel = []
    for (const row of rows) {
      const c = toComment(row)
      byId[c.id] = c
      if (!c.parentId) topLevel.push(c)
    }
    for (const row of rows) {
      if (row.parent_id && byId[row.parent_id]) {
        byId[row.parent_id].replies.push(byId[row.id])
      }
    }

    return res.status(200).json({ comments: topLevel })
  }

  // POST ?flag=true { id } — flag a comment for review
  if (req.method === 'POST' && req.query.flag === 'true') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    await sql`UPDATE comments SET flagged = TRUE WHERE id = ${id}`
    return res.status(200).json({ ok: true })
  }

  // POST { symbol, userEmail, displayName, body, parentId? } — post a comment
  if (req.method === 'POST') {
    const { symbol, userEmail, displayName, body, parentId } = req.body

    if (!symbol || !userEmail || !displayName || !body) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    if (body.length > 280) {
      return res.status(400).json({ error: 'Comment exceeds 280 characters' })
    }
    if (containsBanned(body)) {
      return res.status(400).json({
        error: 'Your comment contains disallowed content (no guaranteed returns, insider info, or price manipulation).',
      })
    }

    // Verify the user has ever held this stock
    const [{ count }] = await sql`
      SELECT COUNT(*) FROM trades WHERE user_email = ${userEmail} AND symbol = ${symbol}
    `
    if (Number(count) === 0) {
      return res.status(403).json({ error: `You must have held ${symbol} to post in this discussion` })
    }

    // Verify parent exists for the same symbol (reply validation)
    if (parentId) {
      const parents = await sql`
        SELECT id FROM comments
        WHERE id = ${parentId} AND symbol = ${symbol} AND deleted_at IS NULL
      `
      if (parents.length === 0) {
        return res.status(400).json({ error: 'Parent comment not found' })
      }
    }

    const [row] = await sql`
      INSERT INTO comments (symbol, user_email, display_name, body, parent_id, is_holder)
      VALUES (${symbol}, ${userEmail}, ${displayName}, ${body}, ${parentId ?? null}, TRUE)
      RETURNING *
    `
    return res.status(201).json({ comment: { ...toComment(row), replies: [] } })
  }

  // DELETE ?id=&email= — soft delete own comment
  if (req.method === 'DELETE') {
    const { id, email } = req.query
    if (!id || !email) return res.status(400).json({ error: 'id and email required' })
    await sql`
      UPDATE comments
      SET deleted_at = NOW()
      WHERE id = ${id} AND user_email = ${email} AND deleted_at IS NULL
    `
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
