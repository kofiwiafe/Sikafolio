import { useState } from 'react'
import Logo from '../components/Logo'
import StockCard from '../components/StockCard'
import { usePortfolio } from '../hooks/usePortfolio'
import { usePortfolioHistory } from '../hooks/usePortfolioHistory'

const RANGES = [
  { label: 'W',  days: 7   },
  { label: '1M', days: 30  },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
]

function Sparkline({ data }) {
  if (!data || data.length < 2) return null
  const W = 280, H = 60
  const values = data.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 4 - ((v - min) / range) * (H - 8),
  ])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ display: 'block', marginTop: 10, overflow: 'visible' }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0C25E" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#F0C25E" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#F0C25E" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {/* end dot */}
      <circle cx={last[0]} cy={last[1]} r="3" fill="#F0C25E" />
      <circle cx={last[0]} cy={last[1]} r="5" fill="rgba(240,194,94,0.25)" />
    </svg>
  )
}

export default function Portfolio({ prices }) {
  const [range, setRange] = useState('1M')
  const { holdings, summary, loading } = usePortfolio(prices?.prices || {})
  const history = usePortfolioHistory()
  const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Filter history to selected range, always pin today's live value as last point
  const selectedDays = RANGES.find(r => r.label === range)?.days
  const today = new Date().toISOString().split('T')[0]
  const cutoff = selectedDays
    ? new Date(Date.now() - selectedDays * 864e5).toISOString().split('T')[0]
    : '0000-00-00'
  const filtered = (history || []).filter(p => p.date >= cutoff && p.date < today)
  const todayValue = summary?.totalValue || 0
  const chartData = todayValue > 0
    ? [...filtered, { date: today, value: todayValue }]
    : filtered

  // PnL within the selected range
  const firstValue = chartData[0]?.value || 0
  const lastValue  = chartData[chartData.length - 1]?.value || 0
  const rangePnL   = lastValue - firstValue
  const rangePct   = firstValue > 0 ? (rangePnL / firstValue) * 100 : 0
  const rangeIsUp  = rangePnL >= 0

  const isUp = (summary?.totalPnL || 0) >= 0

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* App header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <Logo />
        <div className="pill">
          <span className="dot-live" />
          {prices?.updatedAt
            ? `Updated ${prices.updatedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}`
            : 'Syncing…'}
        </div>
      </div>

      {/* Hero card — portfolio value + sparkline */}
      <div style={{ margin: '0 16px 14px', position: 'relative' }}>
        <div className="card" style={{ padding: '16px 20px 12px' }}>
          {/* Gold ambient blob */}
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 200, height: 150, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(240,194,94,0.12) 0%, transparent 65%)',
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                Currently worth
              </div>
              <div className="mono" style={{ fontSize: 36, fontWeight: 500, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-1.5px' }}>
                <span style={{ fontSize: 16, color: 'var(--muted)', letterSpacing: 0, fontWeight: 400 }}>GHS </span>
                {fmt(summary?.totalValue || 0)}
              </div>
              {chartData.length >= 2 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                  background: rangeIsUp ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${rangeIsUp ? 'var(--green-border)' : 'var(--red-border)'}`,
                  borderRadius: 'var(--r-pill)', padding: '3px 9px', fontSize: 12,
                  color: rangeIsUp ? 'var(--green)' : 'var(--red)',
                }}>
                  <span className="mono">{rangeIsUp ? '▲' : '▼'} {Math.abs(rangePct).toFixed(1)}%</span>
                </div>
              )}
              {chartData.length < 2 && summary && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                  background: isUp ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${isUp ? 'var(--green-border)' : 'var(--red-border)'}`,
                  borderRadius: 'var(--r-pill)', padding: '3px 9px', fontSize: 12,
                  color: isUp ? 'var(--green)' : 'var(--red)',
                }}>
                  <span className="mono">{isUp ? '▲' : '▼'} {Math.abs(summary.totalPct).toFixed(1)}%</span>
                </div>
              )}
            </div>

            {/* Time range toggle */}
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {RANGES.map(r => (
                <button
                  key={r.label}
                  onClick={() => setRange(r.label)}
                  style={{
                    padding: '4px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '0.02em',
                    border: range === r.label ? '1px solid var(--gold-border)' : '1px solid var(--border)',
                    background: range === r.label ? 'var(--gold-dim)' : 'transparent',
                    color: range === r.label ? 'var(--gold)' : 'var(--dim)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <Sparkline data={chartData} />
        </div>
      </div>

      {/* 2×2 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, padding: '0 16px 14px' }}>
        {[
          { label: 'Investment',     value: `GHS ${fmt(summary?.totalCost || 0)}` },
          { label: 'Fees paid',      value: `GHS ${fmt(summary?.totalFees || 0)}` },
          { label: 'Total invested', value: `GHS ${fmt((summary?.totalCost || 0) + (summary?.totalFees || 0))}` },
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
