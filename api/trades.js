import { getDb } from './_db.js'

function rowToTrade(row) {
  return {
    id:                 row.id,
    emailId:            row.email_id,
    orderNumber:        row.order_number,
    tradeId:            row.trade_id,
    symbol:             row.symbol,
    orderType:          row.order_type,
    quantity:           parseFloat(row.quantity) || 0,
    grossConsideration: parseFloat(row.gross_consideration) || 0,
    processingFee:      parseFloat(row.processing_fee) || 0,
    netConsideration:   parseFloat(row.net_consideration) || 0,
    pricePerShare:      parseFloat(row.price_per_share) || 0,
    settlementDate:     row.settlement_date,
    executionDate:      row.execution_date,
    status:             row.status,
    source:             row.source,
  }
}

function insertValues(sql, email, t) {
  return sql`
    INSERT INTO trades
      (user_email, email_id, order_number, trade_id, symbol, order_type,
       quantity, gross_consideration, processing_fee, net_consideration,
       price_per_share, settlement_date, execution_date, status, source)
    VALUES
      (${email}, ${t.emailId ?? null}, ${t.orderNumber ?? null}, ${t.tradeId ?? null},
       ${t.symbol}, ${t.orderType}, ${t.quantity ?? null}, ${t.grossConsideration ?? null},
       ${t.processingFee ?? 0}, ${t.netConsideration ?? null}, ${t.pricePerShare ?? null},
       ${t.settlementDate ?? null}, ${t.executionDate ?? null}, ${t.status ?? null}, ${t.source ?? null})
    RETURNING *
  `
}

export default async function handler(req, res) {
  const sql = getDb()

  try {
    // email comes from query (GET/DELETE) or body (POST/PUT)
    const email = req.query.email ?? req.body?.email
    if (!email) return res.status(400).json({ error: 'email required' })

    // ── GET: list all trades for user ─────────────────────────────────
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM trades WHERE user_email = ${email}
        ORDER BY execution_date DESC, created_at DESC
      `
      return res.json({ trades: rows.map(rowToTrade) })
    }

    // ── POST: single or bulk insert ────────────────────────────────────
    if (req.method === 'POST') {
      const { trade, trades } = req.body

      if (trades) {
        if (!trades.length) return res.json({ count: 0, trades: [] })
        const inserted = []
        for (const t of trades) {
          try {
            const rows = await insertValues(sql, email, t)
            inserted.push(rowToTrade(rows[0]))
          } catch (e) {
            console.warn('bulk insert skip:', t.emailId, e.message)
          }
        }
        return res.json({ count: inserted.length, trades: inserted })
      }

      if (trade) {
        const rows = await insertValues(sql, email, trade)
        return res.json({ trade: rowToTrade(rows[0]) })
      }

      return res.status(400).json({ error: 'trade or trades required' })
    }

    // ── PUT: update a single trade ─────────────────────────────────────
    if (req.method === 'PUT') {
      const { id } = req.query
      const { updates: u } = req.body
      if (!id) return res.status(400).json({ error: 'id required' })

      const rows = await sql`
        UPDATE trades SET
          symbol              = COALESCE(${u.symbol             ?? null}, symbol),
          order_type          = COALESCE(${u.orderType          ?? null}, order_type),
          quantity            = COALESCE(${u.quantity           ?? null}, quantity),
          gross_consideration = COALESCE(${u.grossConsideration ?? null}, gross_consideration),
          processing_fee      = COALESCE(${u.processingFee      ?? null}, processing_fee),
          net_consideration   = COALESCE(${u.netConsideration   ?? null}, net_consideration),
          price_per_share     = COALESCE(${u.pricePerShare      ?? null}, price_per_share),
          settlement_date     = COALESCE(${u.settlementDate     ?? null}, settlement_date),
          execution_date      = COALESCE(${u.executionDate      ?? null}, execution_date)
        WHERE id = ${parseInt(id)} AND user_email = ${email}
        RETURNING *
      `
      if (!rows.length) return res.status(404).json({ error: 'trade not found' })
      return res.json({ trade: rowToTrade(rows[0]) })
    }

    // ── DELETE: by id, by source, or clear all ─────────────────────────
    if (req.method === 'DELETE') {
      const { id, source, clearAll } = req.query

      if (id) {
        await sql`DELETE FROM trades WHERE id = ${parseInt(id)} AND user_email = ${email}`
        return res.json({ ok: true })
      }
      if (clearAll) {
        await sql`DELETE FROM trades WHERE user_email = ${email}`
        return res.json({ ok: true })
      }
      if (source) {
        await sql`DELETE FROM trades WHERE user_email = ${email} AND source = ${source}`
        return res.json({ ok: true })
      }
      return res.status(400).json({ error: 'id, source, or clearAll required' })
    }

    res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    console.error('[trades]', err)
    res.status(500).json({ error: err.message })
  }
}
