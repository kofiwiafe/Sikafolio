import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../services/db'

// Fix common OCR digit mis-reads: l/I→1, O→0
function fixDigits(s) {
  return (s ?? '').replace(/[lI]/g, '1').replace(/[oO]/g, '0')
}

function parseAmount(s) {
  if (!s) return 0
  // Handle comma-as-thousands ("1,234.56") and comma-as-decimal ("1234,56")
  const fixed = fixDigits(s)
    .replace(/(\d),(\d{2})(?=\s|$)/, '$1.$2')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '')
  return parseFloat(fixed) || 0
}

function parseDate(s) {
  if (!s) return null
  s = s.trim()
  // "7/04/26", "07/04/2026", "07-04-2026"
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m1) {
    const year = m1[3].length === 2 ? `20${m1[3]}` : m1[3]
    return `${year}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
  }
  // "07 Apr 2026", "7 April 2026"
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }
  const m2 = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})$/i)
  if (m2) {
    const mo = MONTHS[m2[2].toLowerCase()]
    if (mo) return `${m2[3]}-${String(mo).padStart(2,'0')}-${m2[1].padStart(2,'0')}`
  }
  return null
}

function parseContractNote(rawText) {
  const t = rawText.replace(/\r\n/g, '\n')

  function find(re) {
    const m = t.match(re)
    return m ? m[1].trim() : null
  }

  // Order type + symbol from "Description: Buy MTNGH" or bare "Buy MTNGH" in table
  let orderType = null, symbol = null
  const descM = t.match(/description[:\s]+(buy|sell)\s+([A-Za-z]{2,10})/i)
    ?? t.match(/\b(buy|sell)\s+([A-Z]{2,10})\b/i)
  if (descM) {
    orderType = descM[1][0].toUpperCase() + descM[1].slice(1).toLowerCase()
    symbol = descM[2].replace(/^GSE[.\s]*/i, '').toUpperCase()
  }

  // Quantity
  const qtyRaw = find(/\bquantity[:\s]+([\d,\s]+)/i) ?? find(/\bqty[:\s]+([\d,\s]+)/i)
  const quantity = qtyRaw ? parseInt(fixDigits(qtyRaw).replace(/[^\d]/g, ''), 10) || 0 : 0

  // Gross consideration — labeled "Amount" in the trade table
  const amtRaw = find(/\bamount[:\s]+([\d,]+\.?\d*)/i)
    ?? find(/gross consideration[:\s]+([\d,]+\.?\d*)/i)
  const grossConsideration = parseAmount(amtRaw)

  // Fee: Total Charges & Levies
  const feeRaw = find(/total charges[^:\n]{0,25}[:\s]+([\d,]+\.?\d*)/i)
    ?? find(/charges[^:\n]{0,15}levies[^:\n]{0,10}[:\s]+([\d,]+\.?\d*)/i)
    ?? find(/total charges[:\s]+([\d,]+\.?\d*)/i)
  const fee = parseAmount(feeRaw)

  // Dates
  const tradeDateRaw  = find(/trade date[:\s]+([^\n]{1,20})/i)
  const settleDateRaw = find(/settlement date[:\s]+([^\n]{1,20})/i)
  const date          = parseDate(tradeDateRaw)
  const settlementDate = parseDate(settleDateRaw)

  // Order number (long numeric, ≥6 digits)
  const onRaw = find(/order number[:\s]+([^\n]{1,20})/i)
    ?? find(/order no[.:\s]+([^\n]{1,20})/i)
  const orderNumber = onRaw ? (fixDigits(onRaw).match(/\d{5,}/) ?? [null])[0] : null

  // Trade ID (shorter numeric, ≥4 digits; appears below Order Number)
  const tidRaw = find(/trade id[:\s]+([^\n]{1,20})/i)
    ?? find(/trade no[.:\s]+([^\n]{1,20})/i)
  const tradeId = tidRaw ? (fixDigits(tidRaw).match(/\d{4,}/) ?? [null])[0] : null

  return { orderType, symbol, quantity, grossConsideration, fee, date, settlementDate, orderNumber, tradeId }
}

async function checkDuplicate(trade) {
  if (trade.tradeId) {
    const hit = await db.trades.where('tradeId').equals(trade.tradeId).first()
    // tradeId is unique per fill — if it doesn't match, it's not a duplicate
    // (same orderNumber just means a partial fill of the same order)
    return !!hit
  }
  if (trade.orderNumber) {
    const hit = await db.trades.where('orderNumber').equals(trade.orderNumber).first()
    if (hit) return true
  }
  const hit = await db.trades.where('emailId').equals(trade.emailId).first()
  return !!hit
}

const fmt     = n => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}
const toDisplayDate = iso =>
  iso?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
    : iso || ''
const fromDisplayDate = s => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export default function ImportScreenshotModal({ onClose }) {
  const [phase,      setPhase]      = useState('idle')
  const [progress,   setProgress]   = useState(0)
  const [preview,    setPreview]    = useState([])
  const [error,      setError]      = useState(null)
  const [imgSrc,     setImgSrc]     = useState(null)
  const [editingIdx, setEditingIdx] = useState(null)
  const [draft,      setDraft]      = useState(null)
  const fileRef = useRef(null)

  const newCount = preview.filter(p => !p.isDuplicate).length
  const dupCount = preview.filter(p =>  p.isDuplicate).length

  function startEdit(idx) {
    const t = preview[idx].trade
    setDraft({
      symbol:             t.symbol,
      orderType:          t.orderType,
      quantity:           String(t.quantity),
      grossConsideration: String(t.grossConsideration),
      fee:                String(t.processingFee),
      executionDate:      t.executionDate,
      dateDisplay:        toDisplayDate(t.executionDate),
    })
    setEditingIdx(idx)
  }

  function commitEdit() {
    const qty   = +draft.quantity || 0
    const gross = +draft.grossConsideration || 0
    const fee   = +(+draft.fee || 0).toFixed(2)
    const net   = draft.orderType === 'Buy' ? +(gross + fee).toFixed(2) : +(gross - fee).toFixed(2)
    const updated = {
      ...preview[editingIdx].trade,
      symbol:             draft.symbol.toUpperCase().trim(),
      orderType:          draft.orderType,
      quantity:           qty,
      grossConsideration: gross,
      processingFee:      fee,
      netConsideration:   net,
      pricePerShare:      qty > 0 ? +(gross / qty).toFixed(4) : 0,
      executionDate:      draft.executionDate,
    }
    setPreview(prev => prev.map((p, i) => i === editingIdx ? { ...p, trade: updated } : p))
    setEditingIdx(null)
    setDraft(null)
  }

  async function processFile(file) {
    if (!file?.type.startsWith('image/')) return
    setError(null)
    setPhase('processing')
    setProgress(0)
    if (imgSrc) URL.revokeObjectURL(imgSrc)
    setImgSrc(URL.createObjectURL(file))

    try {
      // Resize to max 1600px and encode as base64 before sending to API
      setProgress(0.05)
      const base64 = await new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX = 1600
          let { width: w, height: h } = img
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX }
            else       { w = Math.round(w * MAX / h); h = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL(file.type).split(',')[1])
        }
        img.onerror = reject
        img.src = url
      })
      setProgress(0.3)

      const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      })
      setProgress(0.85)

      const data = await resp.json()
      if (!resp.ok) {
        const msg = data.detail ? `${data.error}: ${data.detail}` : (data.error || `Server error ${resp.status}`)
        throw new Error(msg)
      }

      const trades = data.trades ?? []
      if (!trades.length) throw new Error('No trade found in this image')

      const parsed = trades[0]
      const gross = parsed.grossConsideration || 0
      const qty   = parsed.quantity || 0
      const fee   = +(parsed.fee || 0).toFixed(2)
      const net   = parsed.orderType === 'Buy' ? +(gross + fee).toFixed(2) : +(gross - fee).toFixed(2)
      const orderNumber = parsed.orderNumber ? String(parsed.orderNumber) : null
      const emailId = orderNumber
        ? `screenshot_${orderNumber}`
        : `screenshot_${parsed.symbol}_${parsed.date}_${qty}`

      const trade = {
        symbol:             parsed.symbol,
        orderType:          parsed.orderType,
        quantity:           qty,
        grossConsideration: gross,
        processingFee:      fee,
        netConsideration:   net,
        pricePerShare:      qty > 0 ? +(gross / qty).toFixed(4) : 0,
        executionDate:      parsed.settlementDate || parsed.date,
        settlementDate:     parsed.settlementDate || parsed.date,
        orderNumber:        orderNumber || undefined,
        tradeId:            parsed.tradeId ? String(parsed.tradeId) : undefined,
        emailId,
        source:             'contract_note',
        status:             'COMPLETE',
      }

      setProgress(1)
      const isDuplicate = await checkDuplicate(trade)
      setPreview([{ trade, isDuplicate }])
      setPhase('preview')
    } catch (err) {
      setError(`Analysis failed: ${err.message}`)
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Import Contract Note</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>iC Securities · one trade per note</div>
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
                iC Wealth app → tap a trade → Contract Note<br />
                Take a screenshot and upload here
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
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Analysing with Gemini AI…</div>
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
            {error && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                background: 'rgba(240,194,94,0.07)', border: '1px solid rgba(240,194,94,0.22)',
                borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--gold)', lineHeight: 1.5,
              }}>
                <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} aria-hidden="true" />
                {error}
              </div>
            )}

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
              {preview.map(({ trade: t, isDuplicate }, idx) => {
                const isEditing = editingIdx === idx
                const draftGross = isEditing ? (+draft.grossConsideration || 0) : 0
                const draftQty   = isEditing ? (+draft.quantity || 0) : 0
                const draftFee   = isEditing ? +(+draft.fee || 0).toFixed(2) : 0
                const draftNet   = isEditing
                  ? (draft.orderType === 'Buy' ? +(draftGross + draftFee).toFixed(2) : +(draftGross - draftFee).toFixed(2))
                  : 0

                return (
                  <div key={idx} style={{
                    padding: isEditing ? '12px' : '10px 12px',
                    background: isDuplicate ? 'transparent' : isEditing ? 'rgba(240,194,94,0.04)' : 'rgba(91,227,140,0.04)',
                    border: `1px solid ${isDuplicate ? 'var(--border)' : isEditing ? 'rgba(240,194,94,0.30)' : 'rgba(91,227,140,0.18)'}`,
                    borderRadius: 'var(--r-sm)',
                    opacity: isDuplicate ? 0.45 : 1,
                  }}>
                    {isEditing ? (
                      <div>
                        {preview[idx].trade.orderNumber && (
                          <div className="mono" style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 8 }}>
                            Order #{preview[idx].trade.orderNumber}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                            {['Buy', 'Sell'].map(type => (
                              <button key={type} onClick={() => setDraft(d => ({ ...d, orderType: type }))} style={{
                                padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                background: draft.orderType === type
                                  ? (type === 'Buy' ? 'rgba(240,194,94,0.18)' : 'rgba(255,142,138,0.18)')
                                  : 'transparent',
                                color: draft.orderType === type
                                  ? (type === 'Buy' ? 'var(--gold)' : 'var(--red)')
                                  : 'var(--dim)',
                              }}>
                                {type}
                              </button>
                            ))}
                          </div>
                          <input
                            value={draft.symbol}
                            onChange={e => setDraft(d => ({ ...d, symbol: e.target.value.toUpperCase() }))}
                            placeholder="SYMBOL"
                            style={{
                              flex: 1, padding: '5px 8px', background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border)', borderRadius: 6,
                              color: 'var(--gold)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                            }}
                          />
                          <input
                            type="text"
                            value={draft.dateDisplay}
                            onChange={e => {
                              const display = e.target.value
                              const iso = fromDisplayDate(display)
                              setDraft(d => ({ ...d, dateDisplay: display, executionDate: iso ?? d.executionDate }))
                            }}
                            placeholder="dd/mm/yy"
                            maxLength={8}
                            style={{
                              width: 76, padding: '5px 8px', background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border)', borderRadius: 6,
                              color: 'var(--text)', fontSize: 11, fontFamily: 'monospace',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shares</div>
                            <input
                              type="number"
                              value={draft.quantity}
                              onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))}
                              style={{
                                width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)', borderRadius: 6,
                                color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross (GHS)</div>
                            <input
                              type="number"
                              value={draft.grossConsideration}
                              onChange={e => setDraft(d => ({ ...d, grossConsideration: e.target.value }))}
                              style={{
                                width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)', borderRadius: 6,
                                color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Charges (GHS)</div>
                            <input
                              type="number"
                              value={draft.fee}
                              onChange={e => setDraft(d => ({ ...d, fee: e.target.value }))}
                              style={{
                                width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)', borderRadius: 6,
                                color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </div>
                        {draftGross > 0 && draftQty > 0 && (
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '6px 10px', marginBottom: 8,
                            background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                            fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace',
                          }}>
                            <span>Net: GHS {fmt(draftNet)}</span>
                            <span>@ GHS {(draftGross / draftQty).toFixed(4)}/sh</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditingIdx(null); setDraft(null) }} style={{
                            flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer',
                            background: 'transparent', border: '1px solid var(--border)',
                            color: 'var(--dim)', fontSize: 12,
                          }}>Cancel</button>
                          <button onClick={commitEdit} style={{
                            flex: 2, padding: '7px 0', borderRadius: 6, cursor: 'pointer',
                            background: 'var(--gold-grad)', border: 'none',
                            color: '#080A10', fontSize: 12, fontWeight: 700,
                          }}>Save changes</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
                          color: t.orderType === 'Buy' ? 'var(--gold)' : 'var(--red)',
                          background: t.orderType === 'Buy' ? 'var(--gold-dim)' : 'var(--red-dim)',
                          borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                        }}>
                          {t.orderType?.toUpperCase() ?? '?'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                            {t.quantity ? t.quantity.toLocaleString() : '?'} {t.symbol || '?'}
                          </div>
                          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                            GHS {fmt(t.grossConsideration)} · Charges {fmt(t.processingFee)} · {fmtDate(t.executionDate)}
                          </div>
                          {(t.orderNumber || t.tradeId) && (
                            <div className="mono" style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>
                              {t.orderNumber && `Order #${t.orderNumber}`}
                              {t.orderNumber && t.tradeId && ' · '}
                              {t.tradeId && `Trade ID ${t.tradeId}`}
                            </div>
                          )}
                        </div>
                        {isDuplicate
                          ? <span style={{ fontSize: 10, color: 'var(--gold)', flexShrink: 0 }}>duplicate</span>
                          : (
                            <button onClick={() => startEdit(idx)} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--muted)', padding: 4, fontSize: 15, lineHeight: 1,
                              flexShrink: 0,
                            }}>
                              <i className="ti ti-edit" aria-hidden="true" />
                            </button>
                          )
                        }
                      </div>
                    )}
                  </div>
                )
              })}
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
                onClick={newCount > 0 && editingIdx === null ? importTrades : (editingIdx !== null ? undefined : onClose)}
                disabled={editingIdx !== null}
                style={{
                  flex: 2, padding: 12, borderRadius: 'var(--r-md)', fontWeight: 600,
                  cursor: editingIdx !== null ? 'not-allowed' : 'pointer', border: 'none', fontSize: 13,
                  background: newCount > 0 && editingIdx === null ? 'var(--gold-grad)' : 'rgba(255,255,255,0.06)',
                  boxShadow: newCount > 0 && editingIdx === null ? 'var(--gold-glow)' : 'none',
                  color: newCount > 0 && editingIdx === null ? '#080A10' : 'var(--muted)',
                  opacity: editingIdx !== null ? 0.5 : 1,
                }}
              >
                {editingIdx !== null
                  ? 'Finish editing first'
                  : newCount > 0
                    ? `Import ${newCount} trade${newCount !== 1 ? 's' : ''}`
                    : 'Nothing new to import'}
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={() => {
                  setPhase('idle')
                  setPreview([])
                  setError(null)
                  if (imgSrc) { URL.revokeObjectURL(imgSrc); setImgSrc(null) }
                  if (fileRef.current) fileRef.current.value = ''
                }}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 13, fontWeight: 600,
                }}
              >
                Import another
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  border: 'none', background: 'var(--gold-grad)', boxShadow: 'var(--gold-glow)',
                  color: '#080A10', fontSize: 13, fontWeight: 600,
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
