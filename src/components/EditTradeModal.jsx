import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'
import { GSE_COMPANIES } from '../constants/gseCompanies'

const ALL_TICKERS = Object.entries(GSE_COMPANIES).sort(([a], [b]) => a.localeCompare(b))
const IC_FEE_RATE = 0.025

const inp = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, color: 'var(--text)',
  outline: 'none',
}

const lbl = { fontSize: 11, color: 'var(--dim)', marginBottom: 4, display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase' }

const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function EditTradeModal({ trade, onClose }) {
  const [symbol, setSymbol]       = useState(trade.symbol || '')
  const [orderType, setOrderType] = useState(trade.orderType || 'Buy')
  const [date, setDate]           = useState(trade.settlementDate || new Date().toISOString().split('T')[0])
  const [qty, setQty]             = useState(String(trade.quantity || ''))
  const [price, setPrice]         = useState(String(trade.pricePerShare || ''))
  const [estValue, setEstValue]   = useState('')
  const [priceMode, setPriceMode] = useState('perShare')
  const [symOpen, setSymOpen]     = useState(false)
  const [saving, setSaving]       = useState(false)

  const ownedSymbols = useLiveQuery(() => db.trades.orderBy('symbol').uniqueKeys(), [], [])
  const ownedSet = new Set(ownedSymbols || [])

  const sortedTickers = [
    ...ALL_TICKERS.filter(([t]) => ownedSet.has(t)),
    ...ALL_TICKERS.filter(([t]) => !ownedSet.has(t)),
  ]

  const symResults = symbol
    ? sortedTickers.filter(([ticker, { name }]) =>
        ticker.includes(symbol.toUpperCase()) || name.toLowerCase().includes(symbol.toLowerCase())
      )
    : sortedTickers

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

  const canSave = symbol && qty && date && (priceMode === 'perShare' ? !!price : !!estValue)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    await db.trades.update(trade.id, {
      symbol: symbol.toUpperCase().trim(),
      orderType,
      quantity: parseFloat(qty),
      grossConsideration: gross,
      processingFee: feeVal,
      netConsideration: net,
      pricePerShare: computedPrice,
      settlementDate: date,
      executionDate: new Date(date).toISOString(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-solid)', borderRadius: '16px 16px 0 0', padding: '20px 20px 48px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>Edit Trade</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Symbol */}
          <div style={{ position: 'relative' }}>
            <span style={lbl}>Symbol</span>
            <input
              style={inp} placeholder="Search ticker or company name…"
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
                maxHeight: 180, overflowY: 'auto', marginTop: 2,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}>
                {symResults.map(([ticker, { name }]) => (
                  <div
                    key={ticker}
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
                ))}
              </div>
            )}
          </div>

          {/* Order Type */}
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

          {/* Date */}
          <div>
            <span style={lbl}>Trade Date</span>
            <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Qty + Price/Value */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={lbl}>Quantity (shares)</span>
              <input type="number" min="0" style={inp} placeholder="0"
                value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ ...lbl, marginBottom: 0 }}>
                  {priceMode === 'perShare' ? 'Price / Share (GHS)' : 'Est. Value (GHS)'}
                </span>
                <button
                  type="button"
                  onClick={() => switchMode(priceMode === 'perShare' ? 'estValue' : 'perShare')}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: 10, color: 'var(--gold)', cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {priceMode === 'perShare' ? 'use total' : 'use per share'}
                </button>
              </div>
              {priceMode === 'perShare' ? (
                <input type="number" min="0" step="0.01" style={inp} placeholder="0.00"
                  value={price} onChange={e => setPrice(e.target.value)} />
              ) : (
                <>
                  <input type="number" min="0" step="0.01" style={inp} placeholder="0.00"
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

          {/* Fee summary */}
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
            onClick={handleSave}
            disabled={saving || !canSave}
            style={{
              width: '100%', padding: 13, borderRadius: 'var(--r-md)', cursor: canSave ? 'pointer' : 'default',
              background: canSave ? 'var(--gold-grad)' : 'var(--gold-dim)',
              boxShadow: canSave ? 'var(--gold-glow)' : 'none',
              border: 'none',
              color: canSave ? '#080A10' : 'var(--dim)', fontSize: 14, fontWeight: 700,
              opacity: canSave ? 1 : 0.5,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
