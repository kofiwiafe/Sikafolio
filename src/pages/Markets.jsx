import Logo from '../components/Logo'
import CompanyLogo from '../components/CompanyLogo'
import { getCompany } from '../constants/gseCompanies'

function fmtPrice(n) { return Number(n).toFixed(2) }
function fmtVol(n)   { return Number(n).toLocaleString() }

export default function Markets({ prices }) {
  const { prices: priceMap, updatedAt, loading, refresh } = prices || {}

  const stocks = Object.entries(priceMap || {}).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <Logo />
        <div className="pill">
          <span className="dot-live" />
          Live
        </div>
      </div>

      {/* GSE Composite Index card */}
      <div style={{
        margin: '0 12px 14px',
        background: '#131820',
        border: '0.5px solid #C8A84B',
        borderRadius: 12,
        padding: '13px 15px',
      }}>
        <div style={{ fontSize: 10, color: '#556', letterSpacing: '0.05em', marginBottom: 2 }}>GSE Composite Index</div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0' }}>
          {loading ? '—' : '3,418.72'}
        </div>
        <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 2 }}>▲ +24.86 · +0.73% today</div>
        {updatedAt && (
          <div style={{ fontSize: 10, color: '#445', marginTop: 5 }}>
            Updated {updatedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Section label */}
      <div style={{ fontSize: 10, color: '#556', letterSpacing: '0.06em', padding: '0 20px 8px' }}>
        ALL LISTED EQUITIES · {loading ? '…' : stocks.length}
      </div>

      {/* Stock list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#445', fontSize: 13 }}>
          Fetching live prices…
        </div>
      ) : stocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#445', fontSize: 13, lineHeight: 1.8 }}>
          No price data available.<br />
          <button
            onClick={refresh}
            style={{ color: '#C8A84B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Syne', fontSize: 13, marginTop: 8 }}
          >
            Tap to retry →
          </button>
        </div>
      ) : (
        stocks.map(([symbol, info]) => {
          const up    = info.change > 0
          const flat  = info.change === 0
          const clr   = flat ? '#556' : up ? '#2ecc71' : '#e74c3c'
          const arrow = flat ? '—' : up ? '▲' : '▼'
          const sign  = up ? '+' : ''
          const { name } = getCompany(symbol)

          return (
            <div
              key={symbol}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                borderBottom: '0.5px solid #1a2030',
              }}
            >
              <CompanyLogo symbol={symbol} size="md" />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#e8e8e8',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {name || info.name || symbol}
                </div>
                <div style={{ fontSize: 10, color: '#C8A84B', marginTop: 2, letterSpacing: '0.04em' }}>
                  {symbol}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>
                  GHS {fmtPrice(info.price)}
                </div>
                <div style={{ fontSize: 11, color: clr, marginTop: 2 }}>
                  {arrow} {sign}{fmtPrice(Math.abs(info.change))} ({sign}{Math.abs(info.changePercent).toFixed(2)}%)
                </div>
                {info.volume > 0 && (
                  <div style={{ fontSize: 10, color: '#445', marginTop: 2 }}>
                    Vol {fmtVol(info.volume)}
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
