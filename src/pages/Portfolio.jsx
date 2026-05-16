import { useState } from 'react'
import StockCard from '../components/StockCard'
import PriceInfoSheet from '../components/PriceInfoSheet'
import TopPerformers from '../components/TopPerformers'
import { usePortfolio } from '../hooks/usePortfolio'
import { isMarketOpen } from '../hooks/usePrices'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Portfolio({ prices, user, trades, tradesLoading }) {
  const [showInfo, setShowInfo] = useState(false)
  const marketOpen = isMarketOpen()
  const { holdings, summary, loading } = usePortfolio(trades, prices?.prices || {})
  const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isUp = (summary?.totalPnL || 0) >= 0

  const hasPrices = Object.keys(prices?.prices || {}).length > 0
  const dayChangePct = hasPrices && summary?.totalValue > 0
    ? holdings.reduce((s, h) => s + h.currentValue * (h.changePercent || 0), 0) / summary.totalValue
    : null
  const dayIsUp = (dayChangePct || 0) >= 0

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* App header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'Manrope, system-ui, sans-serif', lineHeight: 1 }}>{getGreeting()},</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'Manrope, system-ui, sans-serif', lineHeight: 1 }}>{user?.name?.split(' ')[0] || 'there'}</div>
        </div>
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

      {/* Hero card */}
      <div style={{ margin: '0 16px 14px', position: 'relative' }}>
        <div className="card" style={{ padding: '22px 20px 0' }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 240, height: 180, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(240,194,94,0.14) 0%, transparent 65%)',
          }} />

          <div style={{ display: 'flex', gap: 0, paddingBottom: 22 }}>
            {/* Left: Current Balance */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: 600 }}>
                Current Balance
              </div>
              <div className="mono" style={{ fontSize: 15, color: 'var(--muted)', letterSpacing: 0, fontWeight: 400, marginBottom: 2 }}>GHS</div>
              <div className="mono" style={{ fontSize: 38, fontWeight: 500, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1.5px' }}>
                {fmt(summary?.totalValue || 0)}
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--border)', margin: '2px 18px 0', flexShrink: 0 }} />

            {/* Right: P&L */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: 600 }}>
                Profit / Loss (P&L)
              </div>
              <div className="mono" style={{ fontSize: 15, color: 'var(--muted)', letterSpacing: 0, fontWeight: 400, marginBottom: 2 }}>GHS</div>
              <div className="mono" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1, letterSpacing: '-1.5px', color: isUp ? 'var(--green)' : 'var(--red)' }}>
                {summary ? (isUp ? '+' : '') + fmt(summary.totalPnL) : '0.00'}
              </div>
            </div>
          </div>

          {/* Footnote stats row */}
          <div style={{
            display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)',
            margin: '0 -20px', padding: '8px 20px 10px',
          }}>
            {[
              { label: 'Invested',    value: `GHS ${fmt(summary?.totalCost || 0)}` },
              { label: 'Fees paid',   value: `GHS ${fmt(summary?.totalFees || 0)}` },
              { label: 'Stocks sold', value: `GHS ${fmt(summary?.stocksSold || 0)}` },
              { label: 'Stocks held', value: `${summary?.positions || 0} stocks` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
                paddingLeft: i > 0 ? 10 : 0,
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                marginLeft: i > 0 ? 10 : 0,
              }}>
                <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Manrope, system-ui, sans-serif', opacity: 0.7 }}>
                  {label}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TopPerformers holdings={holdings} />

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
          Go to <strong style={{ color: 'var(--gold)' }}>Trades</strong> tab and import a contract note to get started.
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {holdings.map(h => <StockCard key={h.symbol} holding={h} />)}
        </div>
      )}
    </div>
  )
}
