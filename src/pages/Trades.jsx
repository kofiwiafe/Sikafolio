import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'
import Logo from '../components/Logo'
import CompanyLogo from '../components/CompanyLogo'
import EditTradeModal from '../components/EditTradeModal'
import ImportScreenshotModal from '../components/ImportScreenshotModal'
import ConfirmCodeModal from '../components/ConfirmCodeModal'
import { getCompany } from '../constants/gseCompanies'

const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Trade row ─────────────────────────────────────────────────────────────────

function TradeRow({ t, isFirst, onEdit, onDelete, pnl }) {
  const isBuy  = t.orderType === 'Buy'
  const date   = new Date(t.executionDate)
  const dateStr = date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })

  const unrealizedPnL = pnl ?? null
  const pnlUp = unrealizedPnL >= 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 16px 11px 72px',
      borderTop: isFirst ? '1px solid var(--border)' : '1px solid var(--divider)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
        color: isBuy ? 'var(--gold)' : 'var(--red)',
        background: isBuy ? 'var(--gold-dim)' : 'var(--red-dim)',
        borderRadius: 4, padding: '2px 6px',
        flexShrink: 0, minWidth: 28, textAlign: 'center',
      }}>
        {t.orderType.toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>
          {t.quantity?.toLocaleString()} shares
          <span style={{ color: 'var(--muted)' }}> @ GHS {fmt(t.pricePerShare)}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
          {dateStr}
          {t.settlementDate ? <span style={{ color: 'var(--dim)' }}> · settled {t.settlementDate}</span> : null}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 12, color: isBuy ? 'var(--text)' : 'var(--red)', whiteSpace: 'nowrap' }}>
          {isBuy ? '+' : '−'} GHS {fmt(t.netConsideration)}
        </div>
        {unrealizedPnL != null && (
          <div className="mono" style={{ fontSize: 10, marginTop: 2, color: pnlUp ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
            {pnlUp ? '▲ +' : '▼ '}GHS {fmt(unrealizedPnL)}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit(t) }}
          title="Edit trade"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
            background: 'var(--gold-dim)',
            border: '1px solid var(--gold-border)',
            color: 'var(--gold)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,194,94,0.20)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold-dim)' }}
        >
          <i className="ti ti-edit" style={{ fontSize: 14 }} aria-hidden="true" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(t) }}
          title="Delete trade"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
            background: 'var(--red-dim)',
            border: '1px solid var(--red-border)',
            color: 'var(--red)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,142,138,0.20)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--red-dim)' }}
        >
          <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ── Company group ─────────────────────────────────────────────────────────────

function CompanyGroup({ symbol, trades, onEdit, onDelete, currentPrice, isOpen, onToggle }) {
  const company = getCompany(symbol)

  const buyTrades   = trades.filter(t => t.orderType === 'Buy')
  const totalBought = buyTrades.reduce((s, t) => s + (t.quantity || 0), 0)
  const totalSold   = trades.filter(t => t.orderType === 'Sell').reduce((s, t) => s + (t.quantity || 0), 0)
  const netShares   = totalBought - totalSold
  const buyCount    = buyTrades.length
  const sellCount   = trades.filter(t => t.orderType === 'Sell').length

  const totalGross    = buyTrades.reduce((s, t) => s + (t.pricePerShare * (t.quantity || 0)), 0)
  const avgCost       = totalBought > 0 ? totalGross / totalBought : 0
  const unrealizedPnL = (currentPrice != null && netShares > 0)
    ? (currentPrice - avgCost) * netShares
    : null
  const pnlUp = unrealizedPnL >= 0

  // Pre-compute per-trade P&Ls using the same currentPrice as the group header
  const tradePnLs = {}
  if (currentPrice != null) {
    for (const t of buyTrades) {
      tradePnLs[t.id] = (currentPrice - t.pricePerShare) * t.quantity
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Company header — tappable to expand/collapse */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <CompanyLogo symbol={symbol} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{symbol}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {buyCount}B{sellCount > 0 ? ` · ${sellCount}S` : ''}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {company.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: netShares > 0 ? 'var(--text)' : 'var(--muted)' }}>
              {netShares.toLocaleString()} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)' }}>shares</span>
            </div>
            {unrealizedPnL != null && (
              <div className="mono" style={{ fontSize: 11, marginTop: 3, color: pnlUp ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                {pnlUp ? '▲ +' : '▼ '}GHS {fmt(unrealizedPnL)}
              </div>
            )}
          </div>
          <i
            className="ti ti-chevron-right"
            style={{
              fontSize: 16, color: 'var(--dim)', flexShrink: 0,
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Trade rows — animated accordion */}
      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen ? `${trades.length * 90 + 20}px` : '0px',
        opacity: isOpen ? 1 : 0,
        transition: 'max-height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
      }}>
        <div style={{ background: 'rgba(0,0,0,0.18)', paddingBottom: 4 }}>
          {trades.map((t, i) => (
            <TradeRow key={t.id} t={t} isFirst={i === 0} onEdit={onEdit} onDelete={onDelete} pnl={tradePnLs[t.id] ?? null} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Trades({ prices }) {
  const [showImport,  setShowImport] = useState(false)
  const [pendingAction, setPending]  = useState(null)
  const [editingTrade,  setEditing]  = useState(null)
  const [openSymbol,  setOpenSymbol] = useState(null)

  function toggleSymbol(sym) {
    setOpenSymbol(s => s === sym ? null : sym)
  }

  const trades = useLiveQuery(() => db.trades.orderBy('executionDate').reverse().toArray(), [])

  const bySymbol = {}
  for (const t of (trades || [])) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []
    bySymbol[t.symbol].push(t)
  }

  const symbols = Object.keys(bySymbol).sort((a, b) => {
    const la = bySymbol[a][0]?.executionDate ?? ''
    const lb = bySymbol[b][0]?.executionDate ?? ''
    return lb.localeCompare(la)
  })

  const totalTrades = (trades || []).length

  function requestEdit(trade)   { setPending({ type: 'edit', trade }) }
  function requestDelete(trade) { setPending({ type: 'delete', trade }) }

  async function onVerified() {
    const action = pendingAction
    setPending(null)
    if (action.type === 'delete') {
      await db.trades.delete(action.trade.id)
    } else {
      setEditing(action.trade)
    }
  }

  const pa = pendingAction

  return (
    <>
      {showImport   && <ImportScreenshotModal  onClose={() => setShowImport(false)} />}
      {editingTrade && <EditTradeModal trade={editingTrade} onClose={() => setEditing(null)} />}

      {pa && (
        <ConfirmCodeModal
          title={pa.type === 'delete' ? 'Delete trade' : 'Edit trade'}
          subtitle={
            pa.type === 'delete'
              ? `This will permanently remove the ${pa.trade.orderType} of ${pa.trade.quantity?.toLocaleString()} ${pa.trade.symbol} shares.`
              : `You are about to edit this ${pa.trade.symbol} trade.`
          }
          destructive={pa.type === 'delete'}
          onVerified={onVerified}
          onCancel={() => setPending(null)}
        />
      )}

      <div style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
          <Logo />
          <button
            onClick={() => setShowImport(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--gold-grad)',
              boxShadow: 'var(--gold-glow)',
              border: 'none',
              borderRadius: 'var(--r-pill)', padding: '7px 13px',
              fontSize: 12, fontWeight: 600, color: '#080A10', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <i className="ti ti-file-import" style={{ fontSize: 14 }} aria-hidden="true" />
            Import
          </button>
        </div>

        {/* Stats glass card — STOCKS · TRADES · BUYS · SELLS */}
        {symbols.length > 0 && (
          <div style={{
            display: 'flex', gap: 0,
            margin: '0 16px 16px',
            background: 'var(--surface)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'STOCKS', value: symbols.length },
              { label: 'TRADES', value: totalTrades },
              { label: 'BUYS',   value: (trades || []).filter(t => t.orderType === 'Buy').length,  color: 'var(--gold)' },
              { label: 'SELLS',  value: (trades || []).filter(t => t.orderType === 'Sell').length, color: 'var(--red)'  },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                flex: 1, textAlign: 'center', padding: '12px 4px',
                borderRight: i < arr.length - 1 ? '1px solid var(--divider)' : 'none',
              }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: color || 'var(--text)', letterSpacing: '-0.5px' }}>{value}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.06em', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {symbols.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)', fontSize: 13, lineHeight: 1.7 }}>
            No trades yet.<br />
            Tap <strong style={{ color: 'var(--gold)' }}>Import</strong> to add from a Contract Note.
          </div>
        ) : (
          symbols.map(symbol => (
            <CompanyGroup
              key={symbol}
              symbol={symbol}
              trades={bySymbol[symbol]}
              onEdit={requestEdit}
              onDelete={requestDelete}
              currentPrice={prices?.prices?.[symbol]?.price ?? null}
              isOpen={openSymbol === symbol}
              onToggle={() => toggleSymbol(symbol)}
            />
          ))
        )}
      </div>
    </>
  )
}
