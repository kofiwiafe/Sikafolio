import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'
import { GSE_COMPANIES } from '../constants/gseCompanies'

const ALL_TICKERS = Object.entries(GSE_COMPANIES).sort(([a], [b]) => a.localeCompare(b))
const IC_FEE_RATE = 0.025

const input = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, color: 'var(--text)',
  outline: 'none',
}

const lbl = { fontSize: 11, color: 'var(--dim)', marginBottom: 4, display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase' }

const fmt = (n) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function tabStyle(active) {
  return {
    flex: 1, padding: '8px 0', fontSize: 12, cursor: 'pointer',
    background: active ? 'var(--gold-dim)' : 'transparent',
    border: `1px solid ${active ? 'var(--gold-border)' : 'var(--border)'}`,
    color: active ? 'var(--gold)' : 'var(--dim)',
    borderRadius: 'var(--r-sm)',
  }
}

export default function AddTradeModal({ onClose }) {
  const [tab, setTab] = useState('manual')

  // Manual form
  const [symbol, setSymbol]       = useState('')
  const [orderType, setOrderType] = useState('Buy')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [qty, setQty]             = useState('')
  const [price, setPrice]         = useState('')
  const [estValue, setEstValue]   = useState('')
  const [priceMode, setPriceMode] = useState('perShare')
  const [saving, setSaving]       = useState(false)
  const [symOpen, setSymOpen]     = useState(false)

  const ownedSymbols = useLiveQuery(
    () => db.trades.orderBy('symbol').uniqueKeys(),
    [], []
  )
  const ownedSet = new Set(ownedSymbols || [])

  const sortedTickers = [
    ...ALL_TICKERS.filter(([t]) => ownedSet.has(t)),
    ...ALL_TICKERS.filter(([t]) => !ownedSet.has(t)),
  ]

  const symResults = symbol
    ? sortedTickers.filter(([ticker, { name }]) =>
        ticker.includes(symbol) || name.toLowerCase().includes(symbol.toLowerCase())
      )
    : sortedTickers

  // Paste form
  const [pastedText, setPastedText] = useState('')
  const [parsed, setParsed]         = useState(null)
  const [parseError, setParseError] = useState(null)

  const qtyNum = parseFloat(qty) || 0
  const gross  = priceMode === 'estValue'
    ? (parseFloat(estValue) || 0)
    : qtyNum * (parseFloat(price) || 0)
  const computedPrice = priceMode === 'estValue' && qtyNum > 0
    ? gross / qtyNum
    : (parseFloat(price) || 0)
  const feeVal = +(gross * IC_FEE_RATE).toFixed(2)
  const net    = orderType === 'Buy' ? gross + feeVal : gross - feeVal

  function switchMode(mode) {
    setPriceMode(mode)
    if (mode === 'perShare') setEstValue('')
    else setPrice('')
  }

  async function saveManual() {
    const hasPrice = priceMode === 'perShare' ? !!price : !!estValue
    if (!symbol || !qty || !hasPrice || !date) return
    setSaving(true)
    await db.trades.add({
      symbol: symbol.toUpperCase().trim(),
      orderType,
      quantity: parseFloat(qty),
      grossConsideration: gross,
      processingFee: feeVal,
      netConsideration: net,
      pricePerShare: computedPrice,
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

  const canSaveManual = symbol && qty && date && (priceMode === 'perShare' ? !!price : !!estValue)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-solid)', borderRadius: '16px 16px 0 0', padding: '20px 20px 48px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>Add Trade</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>
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
            <div style={{ position: 'relative' }}>
              <span style={lbl}>Symbol</span>
              <input
                style={input} placeholder="Search ticker or company name…"
                value={symbol}
                onChange={e => { setSymbol(e.target.value.toUpperCase()); setSymOpen(true) }}
                onFocus={() => setSymOpen(true)}
                onBlur={() => setTimeout(() => setSymOpen(false), 150)}
                autoComplete="off"
              />
              {symOpen && symResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                  background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                  maxHeight: 200, overflowY: 'auto', marginTop: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}>
                  {!symbol && ownedSet.size > 0 && (
                    <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em', padding: '6px 12px 3px', borderBottom: '1px solid var(--divider)' }}>
                      YOUR HOLDINGS
                    </div>
                  )}
                  {symResults.map(([ticker, { name }], i) => {
                    const isOwned   = ownedSet.has(ticker)
                    const prevOwned = i > 0 ? ownedSet.has(symResults[i - 1][0]) : true
                    const showDivider = !symbol && i > 0 && !isOwned && prevOwned && ownedSet.size > 0
                    return (
                      <div key={ticker}>
                        {showDivider && (
                          <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em', padding: '5px 12px 3px', borderBottom: '1px solid var(--divider)' }}>
                            ALL GSE STOCKS
                          </div>
                        )}
                        <div
                          onMouseDown={() => { setSymbol(ticker); setSymOpen(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 12px', cursor: 'pointer',
                            borderBottom: '1px solid var(--divider)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-dim)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{ticker}</span>
                          <span style={{ fontSize: 11, color: 'var(--dim)', maxWidth: '60%', textAlign: 'right' }}>{name}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <span style={lbl}>Order Type</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Buy', 'Sell'].map(t => (
                  <button key={t} onClick={() => setOrderType(t)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    background: orderType === t
                      ? (t === 'Buy' ? 'var(--gold-dim)' : 'var(--red-dim)')
                      : 'transparent',
                    border: `1px solid ${orderType === t ? (t === 'Buy' ? 'var(--gold-border)' : 'var(--red-border)') : 'var(--border)'}`,
                    color: orderType === t ? (t === 'Buy' ? 'var(--gold)' : 'var(--red)') : 'var(--dim)',
                  }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={lbl}>Trade Date</span>
              <input type="date" style={input} value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={lbl}>Quantity (shares)</span>
                <input type="number" min="0" style={input} placeholder="0"
                  value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={lbl}>
                    {priceMode === 'perShare' ? 'Price / Share (GHS)' : 'Est. Value (GHS)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => switchMode(priceMode === 'perShare' ? 'estValue' : 'perShare')}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      fontSize: 10, color: 'var(--gold)', cursor: 'pointer',
                      textDecoration: 'underline', lineHeight: 1, marginBottom: 4,
                    }}
                  >
                    {priceMode === 'perShare' ? 'use total' : 'use per share'}
                  </button>
                </div>
                {priceMode === 'perShare' ? (
                  <input type="number" min="0" step="0.01" style={input} placeholder="0.00"
                    value={price} onChange={e => setPrice(e.target.value)} />
                ) : (
                  <>
                    <input type="number" min="0" step="0.01" style={input} placeholder="0.00"
                      value={estValue} onChange={e => setEstValue(e.target.value)} />
                    {qtyNum > 0 && parseFloat(estValue) > 0 && (
                      <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>
                        = GHS {computedPrice.toLocaleString('en-GH', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} / share
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {gross > 0 && (
              <div style={{
                background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                borderRadius: 'var(--r-sm)', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross</div>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>GHS {fmt(gross)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fee (2.5%)</div>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>GHS {fmt(feeVal)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net</div>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--gold)' }}>GHS {fmt(net)}</div>
                </div>
              </div>
            )}

            <button
              onClick={saveManual}
              disabled={saving || !canSaveManual}
              style={{
                width: '100%', padding: 13, borderRadius: 'var(--r-md)', cursor: canSaveManual ? 'pointer' : 'default',
                background: canSaveManual ? 'var(--gold-grad)' : 'var(--gold-dim)',
                boxShadow: canSaveManual ? 'var(--gold-glow)' : 'none',
                border: 'none',
                color: canSaveManual ? '#080A10' : 'var(--dim)', fontSize: 14, fontWeight: 700,
                opacity: canSaveManual ? 1 : 0.5,
              }}
            >
              {saving ? 'Saving…' : 'Save Trade'}
            </button>
          </div>
        )}

        {/* ── Paste Email ── */}
        {tab === 'paste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              Open your trade confirmation email in any app, select all the text, and paste it below. Works with Gmail, Outlook, Yahoo Mail, or any provider.
            </div>

            <textarea
              style={{ ...input, minHeight: 160, resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-num)', fontSize: 12 }}
              placeholder="Paste the full email body here…"
              value={pastedText}
              onChange={e => { setPastedText(e.target.value); setParsed(null); setParseError(null) }}
            />

            <button
              onClick={handleParse}
              disabled={!pastedText.trim()}
              style={{
                width: '100%', padding: 11, borderRadius: 'var(--r-md)',
                cursor: pastedText.trim() ? 'pointer' : 'default',
                background: 'transparent', border: '1px solid var(--gold-border)',
                color: 'var(--gold)', fontSize: 13,
                opacity: pastedText.trim() ? 1 : 0.35,
              }}
            >
              Parse Email
            </button>

            {parseError && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid var(--red-border)',
                borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--red)', lineHeight: 1.6,
              }}>
                <i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true" />
                {parseError}
              </div>
            )}

            {parsed && (
              <>
                <div style={{
                  background: 'var(--green-dim)', border: '1px solid var(--green-border)',
                  borderRadius: 'var(--r-sm)', padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Parsed successfully
                  </div>
                  {[
                    ['Symbol',            parsed.symbol],
                    ['Order',             parsed.orderType],
                    ['Quantity',          `${parsed.quantity} shares`],
                    ['Price / Share',     `GHS ${fmt(parsed.pricePerShare)}`],
                    ['Processing Fee',    `GHS ${fmt(parsed.processingFee)}`],
                    ['Net Consideration', `GHS ${fmt(parsed.netConsideration)}`],
                    ['Settlement',        parsed.settlementDate || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--dim)' }}>{k}</span>
                      <span className="mono" style={{ color: 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={saveParsed}
                  disabled={saving}
                  style={{
                    width: '100%', padding: 13, borderRadius: 'var(--r-md)', cursor: 'pointer',
                    background: 'var(--gold-grad)', boxShadow: 'var(--gold-glow)',
                    border: 'none',
                    color: '#080A10', fontSize: 14, fontWeight: 700,
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
