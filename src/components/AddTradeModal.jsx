import { useState } from 'react'
import { db } from '../services/db'
import { parseTradeText } from '../services/gmailService'

const input = {
  width: '100%', boxSizing: 'border-box',
  background: '#0d1117', border: '0.5px solid #1e2530',
  borderRadius: 8, padding: '9px 12px',
  fontSize: 13, color: '#ddd',
  fontFamily: 'Syne, sans-serif', outline: 'none',
}

const label = { fontSize: 11, color: '#445', marginBottom: 4, display: 'block' }

const fmt = (n) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function tabStyle(active) {
  return {
    flex: 1, padding: '8px 0', fontSize: 12,
    fontFamily: 'Syne, sans-serif', cursor: 'pointer',
    background: active ? 'rgba(200,168,75,0.15)' : 'transparent',
    border: `0.5px solid ${active ? 'rgba(200,168,75,0.4)' : '#1e2530'}`,
    color: active ? '#C8A84B' : '#445',
    borderRadius: 8,
  }
}

export default function AddTradeModal({ onClose }) {
  const [tab, setTab] = useState('manual')

  // Manual form
  const [symbol, setSymbol]     = useState('')
  const [orderType, setOrderType] = useState('Buy')
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0])
  const [qty, setQty]           = useState('')
  const [price, setPrice]       = useState('')
  const [fee, setFee]           = useState('')
  const [saving, setSaving]     = useState(false)

  // Paste form
  const [pastedText, setPastedText] = useState('')
  const [parsed, setParsed]     = useState(null)
  const [parseError, setParseError] = useState(null)

  const gross  = (parseFloat(qty) || 0) * (parseFloat(price) || 0)
  const feeVal = parseFloat(fee) || 0
  const net    = orderType === 'Buy' ? gross + feeVal : gross - feeVal

  async function saveManual() {
    if (!symbol || !qty || !price || !date) return
    setSaving(true)
    await db.trades.add({
      symbol: symbol.toUpperCase().trim(),
      orderType,
      quantity: parseFloat(qty),
      grossConsideration: gross,
      processingFee: feeVal,
      netConsideration: net,
      pricePerShare: parseFloat(price),
      settlementDate: date,
      executionDate: new Date(date).toISOString(),
      source: 'manual',
      status: 'settled',
    })
    setSaving(false)
    onClose()
  }

  function handleParse() {
    setParseError(null)
    setParsed(null)
    const result = parseTradeText(pastedText)
    if (!result) {
      setParseError('Could not extract trade details. Make sure you pasted the full email body.')
      return
    }
    setParsed(result)
  }

  async function saveParsed() {
    if (!parsed) return
    setSaving(true)
    await db.trades.add(parsed)
    setSaving(false)
    onClose()
  }

  const canSaveManual = symbol && qty && price && date

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#131820', borderRadius: '16px 16px 0 0', padding: '20px 20px 48px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#C8A84B', fontFamily: 'Syne, sans-serif' }}>
            Add Trade
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#445', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          <button style={tabStyle(tab === 'manual')} onClick={() => setTab('manual')}>
            <i className="ti ti-edit" style={{ marginRight: 5 }} aria-hidden="true" />
            Manual Entry
          </button>
          <button style={tabStyle(tab === 'paste')} onClick={() => setTab('paste')}>
            <i className="ti ti-clipboard" style={{ marginRight: 5 }} aria-hidden="true" />
            Paste Email
          </button>
        </div>

        {/* ── Manual Entry ── */}
        {tab === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={label}>Symbol</span>
              <input
                style={input} placeholder="e.g. MTNGH"
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <span style={label}>Order Type</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Buy', 'Sell'].map(t => (
                  <button key={t} onClick={() => setOrderType(t)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Syne, sans-serif', fontSize: 13,
                    background: orderType === t
                      ? (t === 'Buy' ? 'rgba(200,168,75,0.15)' : 'rgba(231,76,60,0.15)')
                      : 'transparent',
                    border: `0.5px solid ${orderType === t ? (t === 'Buy' ? '#C8A84B' : '#e74c3c') : '#1e2530'}`,
                    color: orderType === t ? (t === 'Buy' ? '#C8A84B' : '#e74c3c') : '#445',
                  }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={label}>Trade Date</span>
              <input type="date" style={input} value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={label}>Quantity (shares)</span>
                <input type="number" min="0" style={input} placeholder="0"
                  value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={label}>Price per Share (GHS)</span>
                <input type="number" min="0" step="0.01" style={input} placeholder="0.00"
                  value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>

            <div>
              <span style={label}>Processing Fee (GHS)</span>
              <input type="number" min="0" step="0.01" style={input} placeholder="0.00"
                value={fee} onChange={e => setFee(e.target.value)} />
            </div>

            {gross > 0 && (
              <div style={{
                background: 'rgba(200,168,75,0.05)', border: '0.5px solid rgba(200,168,75,0.15)',
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: '#445', marginBottom: 3 }}>Gross</div>
                  <div className="mono" style={{ fontSize: 13, color: '#ddd' }}>GHS {fmt(gross)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#445', marginBottom: 3 }}>Net (inc. fee)</div>
                  <div className="mono" style={{ fontSize: 13, color: '#C8A84B' }}>GHS {fmt(net)}</div>
                </div>
              </div>
            )}

            <button
              onClick={saveManual}
              disabled={saving || !canSaveManual}
              style={{
                width: '100%', padding: 13, borderRadius: 12, cursor: canSaveManual ? 'pointer' : 'default',
                background: 'rgba(200,168,75,0.15)', border: '0.5px solid rgba(200,168,75,0.4)',
                color: '#C8A84B', fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 600,
                opacity: canSaveManual ? 1 : 0.35,
              }}
            >
              {saving ? 'Saving…' : 'Save Trade'}
            </button>
          </div>
        )}

        {/* ── Paste Email ── */}
        {tab === 'paste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: '#445', lineHeight: 1.7 }}>
              Open your trade confirmation email in any app, select all the text, and paste it below. Works with Gmail, Outlook, Yahoo Mail, or any provider.
            </div>

            <textarea
              style={{ ...input, minHeight: 160, resize: 'vertical', lineHeight: 1.6, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
              placeholder="Paste the full email body here…"
              value={pastedText}
              onChange={e => { setPastedText(e.target.value); setParsed(null); setParseError(null) }}
            />

            <button
              onClick={handleParse}
              disabled={!pastedText.trim()}
              style={{
                width: '100%', padding: 11, borderRadius: 12,
                cursor: pastedText.trim() ? 'pointer' : 'default',
                background: 'transparent', border: '0.5px solid rgba(200,168,75,0.3)',
                color: '#C8A84B', fontSize: 13, fontFamily: 'Syne, sans-serif',
                opacity: pastedText.trim() ? 1 : 0.35,
              }}
            >
              Parse Email
            </button>

            {parseError && (
              <div style={{
                background: 'rgba(231,76,60,0.08)', border: '0.5px solid rgba(231,76,60,0.3)',
                borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#e74c3c', lineHeight: 1.6,
              }}>
                <i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true" />
                {parseError}
              </div>
            )}

            {parsed && (
              <>
                <div style={{
                  background: 'rgba(46,204,113,0.06)', border: '0.5px solid rgba(46,204,113,0.25)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 10, color: '#2ecc71', marginBottom: 8, letterSpacing: '0.06em' }}>
                    PARSED SUCCESSFULLY
                  </div>
                  {[
                    ['Symbol',           parsed.symbol],
                    ['Order',            parsed.orderType],
                    ['Quantity',         `${parsed.quantity} shares`],
                    ['Price / Share',    `GHS ${fmt(parsed.pricePerShare)}`],
                    ['Processing Fee',   `GHS ${fmt(parsed.processingFee)}`],
                    ['Net Consideration',`GHS ${fmt(parsed.netConsideration)}`],
                    ['Settlement',       parsed.settlementDate || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: '#445' }}>{k}</span>
                      <span className="mono" style={{ color: '#ddd' }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={saveParsed}
                  disabled={saving}
                  style={{
                    width: '100%', padding: 13, borderRadius: 12, cursor: 'pointer',
                    background: 'rgba(200,168,75,0.15)', border: '0.5px solid rgba(200,168,75,0.4)',
                    color: '#C8A84B', fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 600,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Trade'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
