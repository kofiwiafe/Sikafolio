import { useState } from 'react'
import Logo from '../components/Logo'
import StockCard from '../components/StockCard'
import PriceInfoSheet from '../components/PriceInfoSheet'
import { usePortfolio } from '../hooks/usePortfolio'
import { isMarketOpen } from '../hooks/usePrices'

export default function Portfolio({ prices }) {
  const [showInfo, setShowInfo] = useState(false)
  const marketOpen = isMarketOpen()
  const { holdings, summary, loading } = usePortfolio(prices?.prices || {})
  const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isUp = (summary?.totalPnL || 0) >= 0

  // Day-over-day change: weighted average of each holding's daily % change by current value
  const hasPrices = Object.keys(prices?.prices || {}).length > 0
  const dayChangePct = hasPrices && summary?.totalValue > 0
    ? holdings.reduce((s, h) => s + h.currentValue * (h.changePercent || 0), 0) / summary.totalValue
    : null
  const dayIsUp = (dayChangePct || 0) >= 0

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* App header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <Logo />
        <div
          role="button"
          onClick={() => setShowInfo(true)}
          className="pill"
          style={{
            color: marketOpen ? 'var(--green)' : 'var(--muted)',
            cursor: 'pointer',
            ...(marketOpen && { background: 'var(--green-dim)', borderColor: 'var(--green-border)' }),
          }}
        >
          {marketOpen
            ? <span className="dot-live" />
            : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dim)', flexShrink: 0 }} />
          }
          <span>{marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}</span>
          <i className="ti ti-info-circle" style={{ fontSize: 12, marginLeft: 1 }} />
        </div>
      </div>

      {/* Hero card — two focal stats */}
      <div style={{ margin: '0 16px 14px', position: 'relative' }}>
        <div className="card" style={{ padding: '16px 20px 18px' }}>
          {/* Gold ambient blob */}
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 200, height: 150, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(240,194,94,0.12) 0%, transparent 65%)',
          }} />

          <div style={{ display: 'flex', gap: 0 }}>
            {/* Left: Current Balance */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                Current Balance
              </div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-1px' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: 0, fontWeight: 400 }}>GHS </span>
                {fmt(summary?.totalValue || 0)}
              </div>
              {dayChangePct !== null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                  background: dayIsUp ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${dayIsUp ? 'var(--green-border)' : 'var(--red-border)'}`,
                  borderRadius: 'var(--r-pill)', padding: '3px 9px', fontSize: 11,
                  color: dayIsUp ? 'var(--green)' : 'var(--red)',
                }}>
                  <span className="mono">{dayIsUp ? '▲' : '▼'} {Math.abs(dayChangePct).toFixed(1)}% today</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--border)', margin: '2px 16px 0', flexShrink: 0 }} />

            {/* Right: Unrealized Profit */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                Profit / Loss (P&L)
              </div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: isUp ? 'var(--green)' : 'var(--red)', lineHeight: 1.1, letterSpacing: '-1px' }}>
                <span style={{ fontSize: 13, letterSpacing: 0, fontWeight: 400 }}>GHS </span>
                {summary ? (isUp ? '+' : '') + fmt(summary.totalPnL) : '0.00'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2×2 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, padding: '0 16px 14px' }}>
        {[
          { label: 'Invested',       value: `GHS ${fmt(summary?.totalCost || 0)}` },
          { label: 'Fees paid',      value: `GHS ${fmt(summary?.totalFees || 0)}` },
          { label: 'Stocks sold',    value: `GHS ${fmt(summary?.stocksSold || 0)}` },
          { label: 'Stocks held',    value: `${summary?.positions || 0} stocks` },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 20px', marginBottom: 8 }}>
        Holdings
      </div>

      <PriceInfoSheet open={showInfo} onClose={() => setShowInfo(false)} updatedAt={prices?.updatedAt} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--dim)', fontSize: 13 }}>
          Loading portfolio…
        </div>
      ) : holdings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)', fontSize: 13, lineHeight: 1.7 }}>
          No trades yet.<br />
          Go to <strong style={{ color: 'var(--gold)' }}>Trades</strong> tab and connect Gmail to import.
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {holdings.map(h => <StockCard key={h.symbol} holding={h} />)}
        </div>
      )}
    </div>
  )
}
