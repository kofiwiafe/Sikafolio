import { db } from './db'

const SENDER = 'noreply@ic.africa'
const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

// ─── Main entry point ────────────────────────────────────────────────────────
// Hybrid sync: first run fetches ALL historical emails,
// subsequent runs only fetch emails since last sync.
export async function syncTrades(accessToken, onProgress, { forceFullScan = false } = {}) {
  const lastSync = await db.syncMeta.get('lastSyncDate')
  const isFirstRun = !lastSync || forceFullScan

  if (forceFullScan) {
    await db.syncMeta.delete('lastSyncDate')
    await db.trades.clear()
  }

  onProgress?.({ step: 'Connecting to Gmail', count: null })

  // in:anywhere catches spam/trash where iC emails sometimes land
  const baseQuery = `from:${SENDER} subject:"Trade Notification" in:anywhere`
  const query = isFirstRun
    ? baseQuery
    : `${baseQuery} after:${Math.floor(new Date(lastSync.value).getTime() / 1000)}`

  onProgress?.({ step: 'Scanning inbox', query, count: null })

  const messages = await listMessages(accessToken, query)

  const existingIds = new Set((await db.trades.toArray()).map(t => t.emailId))
  const newMessages = messages.filter(m => !existingIds.has(m.id))

  onProgress?.({ step: 'Parsing confirmations', count: messages.length })

  let parsed = 0
  for (const msg of newMessages) {
    const detail = await fetchMessage(accessToken, msg.id)
    const trade = parseTradeEmail(detail)
    if (trade) {
      await db.trades.add({ ...trade, emailId: msg.id, source: 'gmail' })
      parsed++
    }
    onProgress?.({ step: 'Parsing confirmations', count: messages.length, parsed })
  }

  // Only save lastSyncDate if we actually completed a successful scan
  await db.syncMeta.put({ key: 'lastSyncDate', value: new Date().toISOString() })
  onProgress?.({ step: 'Sync complete', emailCount: messages.length, tradeCount: parsed, done: true })

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

  if (data.error) {
    throw new Error(data.error.message || `Gmail API error ${res.status}`)
  }

  results.push(...(data.messages || []))

  if (data.nextPageToken) {
    return listMessages(token, query, data.nextPageToken, results)
  }
  return results
}

async function fetchMessage(token, id) {
  const res = await fetch(`${BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || `Gmail API error ${res.status}`)
  return data
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

  // Stop at next known field label so HTML-collapsed emails parse correctly
  const STOP = '(?=\\s*(?:Order|Equity|Share|Gross|Processing|Net|Settlement|Account|Dear|Thank|$))'
  const get = (label) => {
    const match = body.match(new RegExp(label + '[:\\s]+([^\\n]{1,100}?)' + STOP, 'i'))
    return match ? match[1].trim() : null
  }

  const rawSymbol = get('Equity')
  // Strip "GSE." or "GSE " prefix — iC uses both formats e.g. "GSE.SIC" and "GSE MTNGH"
  const symbol = rawSymbol
    ?.replace(/GSE[.\s]+/i, '')
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
  // Fallback: convert HTML to line-delimited text so field regexes work correctly
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|tr|td|li)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
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

  const STOP = '(?=\\s*(?:Order|Equity|Share|Gross|Processing|Net|Settlement|Account|Dear|Thank|$))'
  const get = (label) => {
    const match = body.match(new RegExp(label + '[:\\s]+([^\\n]{1,100}?)' + STOP, 'i'))
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
