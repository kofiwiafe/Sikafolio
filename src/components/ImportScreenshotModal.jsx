import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../services/db'

const IC_FEE_RATE = 0.025

// Resize image to max 1600px on longest side and return base64 JPEG string (no data-URL prefix).
// Keeps file size well under Vercel's 4.5MB body limit.
async function toBase64Resized(file, maxPx = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
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
const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}
// Convert YYYY-MM-DD → dd/mm/yy for display
const toDisplayDate = iso =>
  iso?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
    : iso || ''
// Parse dd/mm/yy or dd/mm/yyyy → YYYY-MM-DD; returns null if not fully formed
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
      executionDate:      t.executionDate,
      dateDisplay:        toDisplayDate(t.executionDate),
    })
    setEditingIdx(idx)
  }

  function commitEdit() {
    const qty   = +draft.quantity || 0
    const gross = +draft.grossConsideration || 0
    const fee   = +(gross * IC_FEE_RATE).toFixed(2)
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
      settlementDate:     draft.executionDate,
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
      setProgress(0.2)
      const image = await toBase64Resized(file)
      setProgress(0.4)

      const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
      })
      setProgress(0.9)

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `Server error ${resp.status}` }))
        throw new Error(err.error || `Server error ${resp.status}`)
      }

      const { trades: rawTrades } = await resp.json()
      setProgress(1)

      if (!rawTrades?.length) {
        setError("No trades found. Make sure the screenshot shows the Order History tab with trade cards fully expanded.")
        setPhase('idle')
        return
      }

      const trades = rawTrades
        .map(t => {
          const gross = +t.grossConsideration || 0
          const qty   = +t.quantity || 0
          const fee   = +(gross * IC_FEE_RATE).toFixed(2)
          const net   = t.orderType === 'Buy' ? +(gross + fee).toFixed(2) : +(gross - fee).toFixed(2)
          const orderNumber = t.orderNumber ? String(t.orderNumber) : null
          const emailId = orderNumber
            ? `screenshot_${orderNumber}`
            : `screenshot_${t.symbol}_${t.date}_${qty}`
          return {
            symbol:             (t.symbol || '').toUpperCase().trim(),
            orderType:          t.orderType,
            quantity:           qty,
            grossConsideration: gross,
            processingFee:      fee,
            netConsideration:   net,
            pricePerShare:      qty > 0 ? +(gross / qty).toFixed(4) : 0,
            executionDate:      t.date,
            settlementDate:     t.date,
            orderNumber:        orderNumber || undefined,
            emailId,
            source:             'screenshot',
            status:             'COMPLETE',
          }
        })
        .filter(t => t.symbol && t.quantity > 0 && t.grossConsideration > 0 && t.executionDate)

      if (!trades.length) {
        setError("Gemini found data but some required fields were missing. Try a clearer screenshot with all card fields visible.")
        setPhase('idle')
        return
      }

      const withDup = await Promise.all(
        trades.map(async t => ({ trade: t, isDuplicate: await checkDuplicate(t) }))
      )
      setPreview(withDup)
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
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Analyzing with Gemini AI…</div>
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
              {preview.map(({ trade: t, isDuplicate }, idx) => {
                const isEditing = editingIdx === idx
                const draftGross = isEditing ? (+draft.grossConsideration || 0) : 0
                const draftQty   = isEditing ? (+draft.quantity || 0) : 0
                const draftFee   = isEditing ? +(draftGross * IC_FEE_RATE).toFixed(2) : 0
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
                      /* ── Edit form ── */
                      <div>
                        {/* Order number reference */}
                        {preview[idx].trade.orderNumber && (
                          <div className="mono" style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 8 }}>
                            Order #{preview[idx].trade.orderNumber}
                          </div>
                        )}
                        {/* Row 1: type toggle + symbol + date */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          {/* Buy/Sell toggle */}
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
                          {/* Symbol */}
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
                          {/* Date */}
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
                        {/* Row 2: qty + gross */}
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
                        </div>
                        {/* Fee summary */}
                        {draftGross > 0 && draftQty > 0 && (
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '6px 10px', marginBottom: 8,
                            background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                            fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace',
                          }}>
                            <span>Fee 2.5%: GHS {fmt(draftFee)}</span>
                            <span>Net: GHS {fmt(draftNet)}</span>
                            <span>@ GHS {(draftGross / draftQty).toFixed(4)}/sh</span>
                          </div>
                        )}
                        {/* Save / Cancel */}
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
                      /* ── Read-only row ── */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                          {t.orderNumber && (
                            <div className="mono" style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>
                              Order #{t.orderNumber}
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
