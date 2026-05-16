import { useState } from 'react'
import Logo from '../components/Logo'
import CompanyLogo from '../components/CompanyLogo'
import PriceInfoSheet from '../components/PriceInfoSheet'
import StockDetailScreen from '../components/StockDetailScreen'
import { getCompany } from '../constants/gseCompanies'
import { isMarketOpen } from '../hooks/usePrices'

function fmtPrice(n) { return Number(n).toFixed(2) }
function fmtVol(n)   { return Number(n).toLocaleString() }

export default function Markets({ prices, user, trades }) {
  const [showInfo,     setShowInfo]     = useState(false)
  const [detailSymbol, setDetailSymbol] = useState(null)
  const marketOpen = isMarketOpen()
  const { prices: priceMap, updatedAt, loading, refresh } = prices || {}

  const stocks = Object.entries(priceMap || {}).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  // trades for the selected symbol (may be empty if user doesn't hold it)
  const detailTrades = detailSymbol
    ? (trades || []).filter(t => t.symbol === detailSymbol)
    : []

  return (
    <div style={{ paddingBottom: 80 }}>

      {detailSymbol && (
        <StockDetailScreen
          symbol={detailSymbol}
          userTrades={detailTrades}
          currentPrice={priceMap?.[detailSymbol]?.price ?? null}
          priceInfo={priceMap?.[detailSymbol] ?? null}
          user={user}
          onEdit={null}
          onDelete={null}
          onClose={() => setDetailSymbol(null)}
        />
      )}

      {/* Header */}
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

      {/* GSE Composite Index — hero glass card */}
      <div style={{ margin: '0 16px 14px', position: 'relative' }}>
        <div className="card" style={{ padding: '13px 15px' }}>
          {/* Gold ambient blob */}
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 200, height: 150, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(240,194,94,0.12) 0%, transparent 65%)',
          }} />
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
            GSE Composite Index
          </div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: 'var(--text)', letterSpacing: '-1px' }}>
            {loading ? '—' : '3,418.72'}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>▲ +24.86 · +0.73% today</div>
          {updatedAt && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 6 }}>
              Updated {updatedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      <PriceInfoSheet open={showInfo} onClose={() => setShowInfo(false)} updatedAt={updatedAt} />

      {/* Section label */}
      <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 20px 8px' }}>
        All listed equities · {loading ? '…' : stocks.length}
      </div>

      {/* Stock list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)', fontSize: 13 }}>
          Fetching live prices…
        </div>
      ) : stocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)', fontSize: 13, lineHeight: 1.8 }}>
          No price data available.<br />
          <button
            onClick={refresh}
            style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, marginTop: 8 }}
          >
            Tap to retry →
          </button>
        </div>
      ) : (
        stocks.map(([symbol, info]) => {
          const up    = info.change > 0
          const flat  = info.change === 0
          const clr   = flat ? 'var(--dim)' : up ? 'var(--green)' : 'var(--red)'
          const arrow = flat ? '—' : up ? '▲' : '▼'
          const sign  = up ? '+' : ''
          const { name } = getCompany(symbol)

          return (
            <div
              key={symbol}
              onClick={() => setDetailSymbol(symbol)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid var(--divider)',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <CompanyLogo symbol={symbol} size="md" />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {name || info.name || symbol}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {symbol}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  GHS {fmtPrice(info.price)}
                </div>
                <div className="mono" style={{ fontSize: 11, color: clr, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {arrow} {sign}{fmtPrice(Math.abs(info.change))} ({sign}{Math.abs(info.changePercent).toFixed(2)}%)
                </div>
                {info.volume > 0 && (
                  <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                    Vol {fmtVol(info.volume)}
                  </div>
                )}
              </div>

              <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--dim)', flexShrink: 0 }} />
            </div>
          )
        })
      )}
    </div>
  )
}
