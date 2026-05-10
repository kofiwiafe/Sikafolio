import Logo from '../components/Logo'

export default function Markets({ prices }) {
  const { prices: priceMap, updatedAt, loading, refresh } = prices || {}
  const fmt = (n) => Number(n).toFixed(2)

  const symbols = Object.entries(priceMap || {}).sort((a, b) => {
    // Put user's holdings first if we had that info — for now sort by volume/alpha
    return a[0].localeCompare(b[0])
  })

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <Logo />
        <div className="pill">
          <span className="dot-live" />
          Live
        </div>
      </div>

      <div style={{
        margin: '0 12px 12px',
        background: '#131820',
        border: '0.5px solid #C8A84B',
        borderRadius: 12,
        padding: '13px 15px',
      }}>
        <div style={{ fontSize: 10, color: '#445', letterSpacing: '0.05em', marginBottom: 2 }}>GSE Composite Index</div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: '#f0f0f0' }}>
          {loading ? '—' : '3,418.72'}
        </div>
        <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 2 }}>▲ +24.86 · +0.73% today</div>
        {updatedAt && (
          <div style={{ fontSize: 10, color: '#334', marginTop: 4 }}>
            Prices updated {updatedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: '#445', letterSpacing: '0.06em', padding: '0 20px', marginBottom: 4 }}>
        All listed equities
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#445', fontSize: 13 }}>Fetching live prices…</div>
      ) : symbols.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#445', fontSize: 13, lineHeight: 1.7 }}>
          No price data available.<br />
          <button onClick={refresh} style={{ color: '#C8A84B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Syne', fontSize: 13, marginTop: 8 }}>
            Tap to retry →
          </button>
        </div>
      ) : (
        symbols.map(([symbol, info]) => {
          const up = (info.changePercent || 0) >= 0
          return (
            <div key={symbol} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 20px',
              borderBottom: '0.5px solid #131820',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#C8A84B' }}>{symbol}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 13, color: '#ddd' }}>GHS {fmt(info.price)}</div>
                <div style={{ fontSize: 11, marginTop: 2, color: info.changePercent === 0 ? '#445' : up ? '#2ecc71' : '#e74c3c' }}>
                  {info.changePercent === 0 ? '— 0.00%' : `${up ? '▲' : '▼'} ${Math.abs(info.changePercent).toFixed(2)}%`}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
