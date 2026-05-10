export default function StockCard({ holding }) {
  const { symbol, netShares, avgCost, currentPrice, currentValue,
          unrealizedPnL, pnlPct, change, changePercent, buyCount } = holding

  const isUp   = unrealizedPnL >= 0
  const dayUp  = changePercent >= 0
  const barPct = Math.min(Math.abs(pnlPct) * 4, 100) // scale bar

  const fmt    = (n) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#C8A84B' }}>{symbol}</span>
            <span style={{ fontSize: 10, color: '#445', background: '#1a1f2e', borderRadius: 20, padding: '2px 8px' }}>
              {netShares.toLocaleString()} shares
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#445', marginTop: 2 }}>
            {buyCount} purchase{buyCount !== 1 ? 's' : ''} · avg GHS {fmt(avgCost)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 14, color: '#ddd' }}>GHS {fmt(currentPrice)}</div>
          <div style={{ fontSize: 11, marginTop: 2, color: dayUp ? '#2ecc71' : '#e74c3c' }}>
            {dayUp ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}% today
          </div>
        </div>
      </div>

      <div className="pnl-bar" style={{ marginBottom: 9 }}>
        <div style={{
          width: `${barPct}%`, height: '100%', borderRadius: 2,
          background: isUp ? '#C8A84B' : '#e74c3c',
          transition: 'width 0.6s ease'
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 2 }}>
        <div>
          <div style={{ fontSize: 10, color: '#445' }}>Mkt value</div>
          <div className="mono" style={{ fontSize: 11, color: '#999' }}>GHS {fmt(currentValue)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#445' }}>Unrealized PnL</div>
          <div className="mono" style={{ fontSize: 11, color: isUp ? '#2ecc71' : '#e74c3c' }}>
            {isUp ? '+' : ''}GHS {fmt(unrealizedPnL)} ({isUp ? '+' : ''}{pnlPct.toFixed(1)}%)
          </div>
        </div>
      </div>
    </div>
  )
}
