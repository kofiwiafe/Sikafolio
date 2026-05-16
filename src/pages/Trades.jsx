import { useState } from 'react'
import Logo from '../components/Logo'
import CompanyLogo from '../components/CompanyLogo'
import EditTradeModal from '../components/EditTradeModal'
import ImportScreenshotModal from '../components/ImportScreenshotModal'
import ConfirmCodeModal from '../components/ConfirmCodeModal'
import StockDetailScreen from '../components/StockDetailScreen'
import { getCompany } from '../constants/gseCompanies'

const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Company card (list item) ──────────────────────────────────────────────────

function CompanyCard({ symbol, trades, currentPrice, onSelect }) {
  const company     = getCompany(symbol)
  const buyTrades   = trades.filter(t => t.orderType === 'Buy')
  const totalBought = buyTrades.reduce((s, t) => s + (t.quantity || 0), 0)
  const totalSold   = trades.filter(t => t.orderType === 'Sell').reduce((s, t) => s + (t.quantity || 0), 0)
  const netShares   = totalBought - totalSold
  const avgCost     = totalBought > 0
    ? buyTrades.reduce((s, t) => s + t.pricePerShare * (t.quantity || 0), 0) / totalBought
    : 0
  const unrealizedPnL = (currentPrice != null && netShares > 0)
    ? (currentPrice - avgCost) * netShares
    : null
  const pnlUp      = (unrealizedPnL ?? 0) >= 0
  const buyCount   = buyTrades.length
  const sellCount  = trades.filter(t => t.orderType === 'Sell').length

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 20px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', userSelect: 'none',
      }}
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
        <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--dim)', flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Trades({ prices, trades, tradesLoading, updateTrade, deleteTrade, addTrades, checkDuplicate, user }) {
  const [showImport,    setShowImport]  = useState(false)
  const [pendingAction, setPending]     = useState(null)
  const [editingTrade,  setEditing]     = useState(null)
  const [detailSymbol,  setDetail]      = useState(null)

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

  function requestEdit(trade)   { setDetail(null); setPending({ type: 'edit',   trade }) }
  function requestDelete(trade) { setDetail(null); setPending({ type: 'delete', trade }) }

  async function onVerified() {
    const action = pendingAction
    setPending(null)
    if (action.type === 'delete') {
      await deleteTrade(action.trade.id)
    } else {
      setEditing(action.trade)
    }
  }

  const pa = pendingAction

  return (
    <>
      {showImport   && <ImportScreenshotModal onClose={() => setShowImport(false)} addTrades={addTrades} checkDuplicate={checkDuplicate} />}
      {editingTrade && <EditTradeModal trade={editingTrade} trades={trades} onClose={() => setEditing(null)} onUpdate={updateTrade} />}

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

      {detailSymbol && (
        <StockDetailScreen
          symbol={detailSymbol}
          userTrades={bySymbol[detailSymbol] || []}
          currentPrice={prices?.prices?.[detailSymbol]?.price ?? null}
          priceInfo={prices?.prices?.[detailSymbol] ?? null}
          user={user}
          onEdit={requestEdit}
          onDelete={requestDelete}
          onClose={() => setDetail(null)}
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
              background: 'var(--gold-grad)', boxShadow: 'var(--gold-glow)',
              border: 'none', borderRadius: 'var(--r-pill)', padding: '7px 13px',
              fontSize: 12, fontWeight: 600, color: '#080A10', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <i className="ti ti-file-import" style={{ fontSize: 14 }} aria-hidden="true" />
            Import
          </button>
        </div>

        {/* Stats glass card */}
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
            <CompanyCard
              key={symbol}
              symbol={symbol}
              trades={bySymbol[symbol]}
              currentPrice={prices?.prices?.[symbol]?.price ?? null}
              onSelect={() => setDetail(symbol)}
            />
          ))
        )}
      </div>
    </>
  )
}
