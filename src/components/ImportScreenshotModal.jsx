import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../services/db'

const IC_FEE_RATE = 0.025

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

// OCR commonly swaps l/I for 1 and O for 0 inside digit strings
function fixOcrDigits(str) {
  return str.replace(/[lI]/g, '1').replace(/[oO]/g, '0')
}

function parseTradeLiveText(rawText) {
  const results = []

  // Anchor on "Order number XXXXXXX".
  // Each anchor is the START of a card's body — we search BEFORE it for the header
  // (symbol, date) and AFTER it for the body fields (quantity, estimated value).
  // This keeps every card's fields strictly isolated from adjacent cards.
  const anchorRe = /order\s*number\s*[:\s]*\s*([\d\w]{6,})/gi
  const anchors  = []
  let m
  while ((m = anchorRe.exec(rawText)) !== null) {
    const orderNumber = fixOcrDigits(m[1]).replace(/[^\d]/g, '')
    if (orderNumber.length >= 6) {
      anchors.push({ orderNumber, index: m.index, end: m.index + m[0].length })
    }
  }
  if (anchors.length === 0) return results

  for (let k = 0; k < anchors.length; k++) {
    const { orderNumber, index: onIndex, end: onEnd } = anchors[k]

    // preBlock — from the previous anchor's end to this anchor's start.
    // Contains THIS card's header: "Buy 41 MTNGH", "6th May 2026".
    const preStart = k === 0 ? 0 : anchors[k - 1].end
    const preBlock = rawText.slice(preStart, onIndex)

    // postBlock — from this anchor to the next anchor (or end).
    // Contains THIS card's body: Buy/Sell, Quantity, Estimated value.
    const postEnd   = k < anchors.length - 1 ? anchors[k + 1].index : rawText.length
    const postBlock = rawText.slice(onIndex, postEnd)

    // Symbol: take the LAST header match in preBlock so we get the closest card header,
    // not something from the stock price section further up the screenshot.
    const headerMatches = [...preBlock.matchAll(/\b(buy|sell)\s+[\d\w]+\s+([A-Z]{2,10})\b/gi)]
    const headerM = headerMatches[headerMatches.length - 1]
    const symbol  = headerM ? headerM[2].toUpperCase() : null

    // Order type: explicit "Buy/Sell  Buy" row in body is more reliable than the header
    const bsM     = postBlock.match(/buy.{0,3}sell\s+(buy|sell)/i)
    const rawType = bsM ? bsM[1] : (headerM ? headerM[1] : null)
    const orderType = rawType ? rawType[0].toUpperCase() + rawType.slice(1).toLowerCase() : null

    // Date: ordinal format in preBlock ("6th May 2026") — card-specific, avoids
    // matching the "As of 10 May 2026" stock price header which has no ordinal suffix
    let date = null
    const ordM = preBlock.match(/(\d{1,2})(?:st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i)
    if (ordM) {
      date = new Date(+ordM[3], MONTHS[ordM[2].toLowerCase()], +ordM[1]).toISOString().split('T')[0]
    }

    // Quantity: from postBlock with OCR correction ("4l" → "41")
    const qM  = postBlock.match(/\bquantity\s*[:\s]*\s*([\d\w]+)/i)
    const qty = qM ? +(fixOcrDigits(qM[1]).replace(/[^\d]/g, '')) : null

    // Estimated value: from postBlock only — never bleeds from adjacent cards
    const evM  = postBlock.match(/estimated\s*value\s*[:\s]*\s*([\d,]+\.?\d*)/i)
    const gross = evM ? +evM[1].replace(/,/g, '') : null

    if (orderType && symbol && qty > 0 && date && gross > 0) {
      const fee = +(gross * IC_FEE_RATE).toFixed(2)
      const net = orderType === 'Buy' ? +(gross + fee).toFixed(2) : +(gross - fee).toFixed(2)
      results.push({
        symbol,
        orderType,
        quantity: qty,
        grossConsideration: gross,
        processingFee: fee,
        netConsideration: net,
        pricePerShare: +(gross / qty).toFixed(4),
        executionDate: date,
        settlementDate: date,
        orderNumber,
        emailId: `screenshot_${orderNumber}`,
        source: 'screenshot',
        status: 'COMPLETE',
      })
    }
  }

  return results
}

async function checkDuplicate(trade) {
  if (trade.orderNumber) {
    const hit = await db.trades.where('orderNumber').equals(trade.orderNumber).first()
    if (hit) return true
  }
  const hit = await db.trades.where('emailId').equals(trade.emailId).first()
  return !!hit
}

const fmt     = n => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function ImportScreenshotModal({ onClose }) {
  const [phase,    setPhase]    = useState('idle')
  const [progress, setProgress] = useState(0)
  const [preview,  setPreview]  = useState([])
  const [error,    setError]    = useState(null)
  const [imgSrc,   setImgSrc]   = useState(null)
  const fileRef = useRef(null)

  const newCount = preview.filter(p => !p.isDuplicate).length
  const dupCount = preview.filter(p =>  p.isDuplicate).length

  async function processFile(file) {
    if (!file?.type.startsWith('image/')) return
    setError(null)
    setPhase('processing')
    setProgress(0)
    if (imgSrc) URL.revokeObjectURL(imgSrc)
    setImgSrc(URL.createObjectURL(file))

    let fakeP = 0
    const timer = setInterval(() => {
      fakeP = Math.min(fakeP + 0.012, 0.85)
      setProgress(fakeP)
    }, 120)

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })

      clearInterval(timer)
      setProgress(1)

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Vision API error')
      }
      const { text } = await res.json()

      const trades = parseTradeLiveText(text)
      if (trades.length === 0) {
        setError("No trades found. Make sure the screenshot shows the Order History tab with trade cards fully expanded.")
        setPhase('idle')
        return
      }

      const withDup = await Promise.all(
        trades.map(async t => ({ trade: t, isDuplicate: await checkDuplicate(t) }))
      )
      setPreview(withDup)
      setPhase('preview')
    } catch (err) {
      clearInterval(timer)
      setError(`Reading failed: ${err.message}`)
      setPhase('idle')
    }
  }

  async function importTrades() {
    setPhase('importing')
    await db.trades.bulkAdd(preview.filter(p => !p.isDuplicate).map(p => p.trade))
    setPhase('done')
  }

  const handlePaste = useCallback(e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
    if (item) processFile(item.getAsFile())
  }, [])

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }}
      onClick={phase === 'idle' || phase === 'preview' ? onClose : undefined}
    >
      <div
        style={{
          width: '100%', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--surface-solid)',
          borderRadius: '16px 16px 0 0',
          padding: '24px 20px 48px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Import from Screenshot</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>iC Wealth · Order History</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, fontSize: 18, lineHeight: 1 }}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* ── IDLE: drop zone ── */}
        {phase === 'idle' && (
          <>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 'var(--r-md)',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <i className="ti ti-camera" style={{ fontSize: 32, color: 'var(--muted)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                Paste or tap to upload
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
                iC Wealth app → tap a stock → Order History<br />
                Expand trade cards → take a screenshot
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => processFile(e.target.files?.[0])}
            />

            {error && (
              <div style={{
                marginTop: 14, padding: '10px 14px',
                background: 'var(--red-dim)', border: '1px solid var(--red-border)',
                borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--red)', lineHeight: 1.5,
              }}>
                <i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true" />
                {error}
              </div>
            )}
          </>
        )}

        {/* ── PROCESSING ── */}
        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
            {imgSrc && (
              <img
                src={imgSrc} alt="Screenshot preview"
                style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, marginBottom: 18, objectFit: 'contain' }}
              />
            )}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Analyzing with Cloud Vision…</div>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'var(--gold-grad)',
                width: `${Math.round(progress * 100)}%`,
                transition: 'width 0.25s ease',
              }} />
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>
              {Math.round(progress * 100)}%
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {phase === 'preview' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {newCount > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px',
                  background: 'rgba(91,227,140,0.10)', border: '1px solid rgba(91,227,140,0.22)',
                  borderRadius: 99, color: 'var(--green)',
                }}>
                  {newCount} new
                </span>
              )}
              {dupCount > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px',
                  background: 'rgba(240,194,94,0.08)', border: '1px solid rgba(240,194,94,0.18)',
                  borderRadius: 99, color: 'var(--gold)',
                }}>
                  {dupCount} already imported
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {preview.map(({ trade: t, isDuplicate }, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: isDuplicate ? 'transparent' : 'rgba(91,227,140,0.04)',
                  border: `1px solid ${isDuplicate ? 'var(--border)' : 'rgba(91,227,140,0.18)'}`,
                  borderRadius: 'var(--r-sm)',
                  opacity: isDuplicate ? 0.45 : 1,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
                    color: t.orderType === 'Buy' ? 'var(--gold)' : 'var(--red)',
                    background: t.orderType === 'Buy' ? 'var(--gold-dim)' : 'var(--red-dim)',
                    borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                  }}>
                    {t.orderType.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {t.quantity.toLocaleString()} {t.symbol}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                      GHS {fmt(t.grossConsideration)} · {fmtDate(t.executionDate)}
                    </div>
                  </div>
                  {isDuplicate
                    ? <span style={{ fontSize: 10, color: 'var(--gold)', flexShrink: 0 }}>duplicate</span>
                    : <i className="ti ti-circle-check" style={{ color: 'var(--green)', fontSize: 17, flexShrink: 0 }} aria-hidden="true" />
                  }
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: 12, borderRadius: 'var(--r-md)', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--dim)', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={newCount > 0 ? importTrades : onClose}
                style={{
                  flex: 2, padding: 12, borderRadius: 'var(--r-md)', fontWeight: 600,
                  cursor: 'pointer', border: 'none', fontSize: 13,
                  background: newCount > 0 ? 'var(--gold-grad)' : 'rgba(255,255,255,0.06)',
                  boxShadow: newCount > 0 ? 'var(--gold-glow)' : 'none',
                  color: newCount > 0 ? '#080A10' : 'var(--muted)',
                }}
              >
                {newCount > 0 ? `Import ${newCount} trade${newCount !== 1 ? 's' : ''}` : 'Nothing new to import'}
              </button>
            </div>
          </>
        )}

        {/* ── IMPORTING ── */}
        {phase === 'importing' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            Saving trades…
          </div>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <i className="ti ti-circle-check" style={{ fontSize: 36, color: 'var(--green)', display: 'block', marginBottom: 12 }} aria-hidden="true" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
              {newCount} trade{newCount !== 1 ? 's' : ''} imported
            </div>
            {dupCount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>
                {dupCount} duplicate{dupCount !== 1 ? 's' : ''} skipped
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                marginTop: 16, padding: '10px 28px',
                borderRadius: 'var(--r-md)', cursor: 'pointer', border: 'none',
                background: 'var(--gold-grad)', boxShadow: 'var(--gold-glow)',
                color: '#080A10', fontSize: 13, fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
