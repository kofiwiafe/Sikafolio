import CompanyLogo from './CompanyLogo'

export default function StockCard({ holding }) {
  const { symbol, netShares, currentPrice, currentValue,
          unrealizedPnL, pnlPct, changePercent } = holding

  const isUp  = unrealizedPnL >= 0
  const dayUp = changePercent >= 0

  const fmt = (n) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const accentBar = {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    background: isUp
      ? 'linear-gradient(180deg, #5BE38C, rgba(91,227,140,0.33))'
      : 'linear-gradient(180deg, #FF8E8A, rgba(255,142,138,0.33))',
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Left accent bar */}
      <div style={accentBar} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9, paddingLeft: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <CompanyLogo symbol={symbol} size="md" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', lineHeight: 1.2 }}>{symbol}</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
              {netShares.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>shares</span>
            </div>
            <div className="mono" style={{ fontSize: 12, marginTop: 3, color: isUp ? 'var(--green)' : 'var(--red)' }}>
              {isUp ? '▲' : '▼'} {isUp ? '+' : ''}GHS {fmt(unrealizedPnL)} ({isUp ? '+' : ''}{pnlPct.toFixed(1)}%)
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.05em', marginBottom: 2, textTransform: 'uppercase' }}>Current price</div>
          <div className="mono" style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap' }}>GHS {fmt(currentPrice)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mkt value</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>GHS {fmt(currentValue)}</div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: dayUp ? 'var(--green)' : 'var(--red)', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {dayUp ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}% today
        </div>
      </div>
    </div>
  )
}
