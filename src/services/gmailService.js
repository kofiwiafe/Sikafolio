import { db } from './db'

const SENDER = 'noreply@ic.africa'
const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

// ─── Main entry point ────────────────────────────────────────────────────────
// Hybrid sync: first run fetches ALL historical emails,
// subsequent runs only fetch emails since last sync.
export async function syncTrades(accessToken, onProgress) {
  const lastSync = await db.syncMeta.get('lastSyncDate')
  const isFirstRun = !lastSync

  onProgress?.({ step: 'Connecting to Gmail…', count: null })

  const query = isFirstRun
    ? `from:${SENDER} subject:"TRADE CONFIRMATION"`
    : `from:${SENDER} subject:"TRADE CONFIRMATION" after:${Math.floor(new Date(lastSync.value).getTime() / 1000)}`

  const messages = await listMessages(accessToken, query)
  onProgress?.({ step: `Found ${messages.length} confirmation emails`, count: messages.length })

  const existingIds = new Set((await db.trades.toArray()).map(t => t.emailId))
  const newMessages = messages.filter(m => !existingIds.has(m.id))

  onProgress?.({ step: `Parsing ${newMessages.length} new trades…`, count: newMessages.length })

  let parsed = 0
  for (const msg of newMessages) {
    const detail = await fetchMessage(accessToken, msg.id)
    const trade = parseTradeEmail(detail)
    if (trade) {
      await db.trades.add({ ...trade, emailId: msg.id, source: 'gmail' })
      parsed++
    }
    onProgress?.({ step: `Parsed ${parsed} of ${newMessages.length} trades`, count: parsed })
  }

  // Save sync timestamp
  await db.syncMeta.put({ key: 'lastSyncDate', value: new Date().toISOString() })
  onProgress?.({ step: 'Sync complete', count: parsed, done: true })

  return parsed
}

// ─── Gmail API helpers ────────────────────────────────────────────────────────
async function listMessages(token, query, pageToken = null, results = []) {
  const url = new URL(`${BASE}/messages`)
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', '100')
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()

  results.push(...(data.messages || []))

  // Paginate automatically through all results
  if (data.nextPageToken) {
    return listMessages(token, query, data.nextPageToken, results)
  }
  return results
}

async function fetchMessage(token, id) {
  const res = await fetch(`${BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()
}

// ─── Email parser ─────────────────────────────────────────────────────────────
// Parses the iC Securities trade confirmation email format:
//   Order Type: Buy
//   Equity   GSE MTNGH
//   Share Quantity: 41
//   Gross Consideration: 278.80
//   Processing Fee: 6.98
//   Net Consideration: 285.78
//   Settlement Date:  Tue, 12 May, 2026
export function parseTradeEmail(emailData) {
  const body = extractBody(emailData)
  if (!body) return null

  const get = (label) => {
    const match = body.match(new RegExp(label + '[:\\s]+([^\\n<\\r]+)', 'i'))
    return match ? match[1].trim() : null
  }

  const rawSymbol = get('Equity')
  const symbol = rawSymbol
    ?.replace(/GSE\s*/i, '')
    ?.replace(/MTNGH/i, 'MTNGH')
    ?.trim()
    ?.toUpperCase()

  const orderType   = get('Order Type')
  const quantity    = parseFloat(get('Share Quantity'))
  const gross       = parseFloat(get('Gross Consideration'))
  const fee         = parseFloat(get('Processing Fee'))
  const net         = parseFloat(get('Net Consideration'))
  const settlement  = get('Settlement Date')

  if (!symbol || isNaN(quantity) || isNaN(gross)) return null

  return {
    symbol,
    orderType: orderType?.trim() || 'Buy',
    quantity,
    grossConsideration: gross,
    processingFee: fee || 0,
    netConsideration: net || gross,
    pricePerShare: gross / quantity,
    settlementDate: settlement?.trim() || null,
    executionDate: new Date(Number(emailData.internalDate)).toISOString(),
    status: 'settled'
  }
}

function extractBody(emailData) {
  const parts = flattenParts(emailData.payload)
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    }
  }
  // Fallback to HTML part
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    }
  }
  return null
}

function flattenParts(payload) {
  if (!payload) return []
  const result = [payload]
  if (payload.parts) {
    for (const p of payload.parts) result.push(...flattenParts(p))
  }
  return result
}

// ─── Paste-to-import parser ───────────────────────────────────────────────────
// Works on raw text copied from any email client — no Gmail API needed.
export function parseTradeText(rawText) {
  const body = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  const get = (label) => {
    const match = body.match(new RegExp(label + '[:\\s]+([^\\n<\\r]+)', 'i'))
    return match ? match[1].trim() : null
  }

  const rawSymbol = get('Equity')
  const symbol = rawSymbol
    ?.replace(/GSE\s*/i, '')
    ?.trim()
    ?.toUpperCase()

  const orderType = get('Order Type')
  const quantity  = parseFloat(get('Share Quantity'))
  const gross     = parseFloat(get('Gross Consideration'))
  const fee       = parseFloat(get('Processing Fee'))
  const net       = parseFloat(get('Net Consideration'))
  const settlement = get('Settlement Date')

  if (!symbol || isNaN(quantity) || isNaN(gross)) return null

  const parsedDate = settlement ? new Date(settlement) : null
  const executionDate = parsedDate && !isNaN(parsedDate)
    ? parsedDate.toISOString()
    : new Date().toISOString()

  return {
    symbol,
    orderType: orderType?.trim() || 'Buy',
    quantity,
    grossConsideration: gross,
    processingFee: fee || 0,
    netConsideration: net || gross,
    pricePerShare: gross / quantity,
    settlementDate: settlement?.trim() || null,
    executionDate,
    source: 'paste',
    status: 'settled'
  }
}
