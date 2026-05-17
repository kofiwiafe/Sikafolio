import { useState } from 'react'
import StockCard from '../components/StockCard'
import PriceInfoSheet from '../components/PriceInfoSheet'
import TopPerformers from '../components/TopPerformers'
import Logo from '../components/Logo'
import { usePortfolio } from '../hooks/usePortfolio'
import { isMarketOpen } from '../hooks/usePrices'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ComingSoonModal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#10131A', borderRadius: 20, border: '1px solid var(--border)', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'modal-in 0.28s cubic-bezier(0.22,1,0.36,1) both' }}>
        <i className="ti ti-clock" style={{ fontSize: 40, color: 'var(--gold)' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'Manrope, system-ui, sans-serif' }}>Coming soon</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>This feature is on the roadmap and will be available in a future update.</div>
        <button onClick={onClose} style={{ marginTop: 8, padding: '10px 28px', borderRadius: 10, background: 'var(--gold)', color: '#080A10', fontWeight: 700, fontSize: 14, fontFamily: 'Manrope, system-ui, sans-serif', border: 'none', cursor: 'pointer' }}>Got it</button>
      </div>
    </div>
  )
}

export default function Portfolio({ prices, user, trades, tradesLoading }) {
  const [showInfo, setShowInfo] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const marketOpen = isMarketOpen()
  const { holdings, summary, loading } = usePortfolio(trades, prices?.prices || {})
  const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isUp = (summary?.totalPnL || 0) >= 0

  const hasPrices = Object.keys(prices?.prices || {}).length > 0
  const dayChangePct = hasPrices && summary?.totalValue > 0
    ? holdings.reduce((s, h) => s + h.currentValue * (h.changePercent || 0), 0) / summary.totalValue
    : null
  const dayIsUp = (dayChangePct || 0) >= 0

  const iconBtn = {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--muted)', fontSize: 18,
    flexShrink: 0,
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}

      {/* Brand bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
        <Logo size="md" />
        <div style={{ display: 'flex', gap: 8 }}>
          <div role="button" onClick={() => setShowComingSoon(true)} style={iconBtn}>
            <i className="ti ti-search" />
          </div>
          <div role="button" onClick={() => setShowComingSoon(true)} style={iconBtn}>
            <i className="ti ti-bell" />
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ padding: '16px 20px 14px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'Manrope, system-ui, sans-serif', marginBottom: 2 }}>
          {getGreeting()},
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', fontFamily: 'Manrope, system-ui, sans-serif', lineHeight: 1.2, marginBottom: 12 }}>
          {user?.name?.split(' ')[0] || 'there'} 👋
        </div>
        <div
          role="button"
          onClick={() => setShowInfo(true)}
          className="pill"
          style={{
            display: 'inline-flex',
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: 600 }}>
                Current Balance
              </div>
              <div className="mono" style={{ fontSize: 15, color: 'var(--muted)', letterSpacing: 0, fontWeight: 400, marginBottom: 2 }}>GHS</div>
              <div className="mono" style={{ fontSize: 'clamp(20px, 6.5vw, 38px)', fontWeight: 500, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmt(summary?.totalValue || 0)}
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--border)', margin: '2px 12px 0', flexShrink: 0 }} />

            {/* Right: P&L */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: 600 }}>
                P&L
              </div>
              <div className="mono" style={{ fontSize: 15, color: 'var(--muted)', letterSpacing: 0, fontWeight: 400, marginBottom: 2 }}>GHS</div>
              <div className="mono" style={{ fontSize: 'clamp(20px, 6.5vw, 38px)', fontWeight: 500, lineHeight: 1, letterSpacing: '-1px', color: isUp ? 'var(--green)' : 'var(--red)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              { label: 'Invested', value: fmt(summary?.totalCost || 0) },
              { label: 'Fees',     value: fmt(summary?.totalFees || 0) },
              { label: 'Sold',     value: fmt(summary?.stocksSold || 0) },
              { label: 'Held',     value: `${summary?.positions || 0} stocks` },
            ].map(({ label, value }, i) => (
              <div key={label} style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
                paddingLeft: i > 0 ? 8 : 0,
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                marginLeft: i > 0 ? 8 : 0,
              }}>
                <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Manrope, system-ui, sans-serif', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </div>
                <div className="mono" style={{ fontSize: 'clamp(9px, 2.6vw, 11px)', color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
