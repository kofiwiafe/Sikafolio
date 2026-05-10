import Logo from '../components/Logo'
import StockCard from '../components/StockCard'
import { usePortfolio } from '../hooks/usePortfolio'

export default function Portfolio({ prices }) {
  const { holdings, summary, loading } = usePortfolio(prices?.prices || {})
  const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isUp = (summary?.totalPnL || 0) >= 0

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <Logo />
        <div className="pill">
          <span className="dot-live" />
          {prices?.updatedAt
            ? `Updated ${prices.updatedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}`
            : 'Syncing…'}
        </div>
      </div>


      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ fontSize: 11, color: '#445', letterSpacing: '0.05em', marginBottom: 4 }}>
          Total {isUp ? 'gains' : 'loss'}
        </div>
        <div className="mono" style={{ fontSize: 30, fontWeight: 500, color: isUp ? '#2ecc71' : '#e74c3c', lineHeight: 1.1 }}>
          {isUp ? '+' : ''}GHS {fmt(summary?.totalPnL || 0)}
        </div>
        {summary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: isUp ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)',
              border: `0.5px solid ${isUp ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)'}`,
              borderRadius: 20, padding: '3px 9px', fontSize: 12,
              color: isUp ? '#2ecc71' : '#e74c3c',
            }}>
              <i className={`ti ti-trending-${isUp ? 'up' : 'down'}`} style={{ fontSize: 12 }} aria-hidden="true" />
              {isUp ? '+' : ''}{summary.totalPct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: '#556', letterSpacing: '0.03em' }}>
              Portfolio value: <span style={{ color: '#aaa' }}>GHS {fmt(summary.totalValue)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, padding: '0 20px 14px' }}>
        {[
          { label: 'Invested',       value: `GHS ${fmt(summary?.totalCost || 0)}` },
          { label: 'Unrealized PnL', value: `${isUp ? '+' : ''}GHS ${fmt(summary?.totalPnL || 0)}`, color: isUp ? '#2ecc71' : '#e74c3c' },
          { label: 'Positions',      value: `${summary?.positions || 0} stocks` },
          { label: 'Last trade',     value: summary?.lastTrade || '—' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 10, color: '#445', letterSpacing: '0.05em', marginBottom: 3 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 13, color: s.color || '#ccc' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: '#445', letterSpacing: '0.06em', padding: '0 20px', marginBottom: 8 }}>
        Holdings
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#445', fontSize: 13 }}>
          Loading portfolio…
        </div>
      ) : holdings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#445', fontSize: 13, lineHeight: 1.7 }}>
          No trades yet.<br />
          Go to <strong style={{ color: '#C8A84B' }}>Trades</strong> tab and connect Gmail to import.
        </div>
      ) : (
        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {holdings.map(h => <StockCard key={h.symbol} holding={h} />)}
        </div>
      )}
    </div>
  )
}
