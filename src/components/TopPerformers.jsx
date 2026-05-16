const fmt = n => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TopPerformers({ holdings }) {
  if (!holdings || holdings.length === 0) return null

  const winners = [...holdings]
    .filter(h => h.pnlPct > 0)
    .sort((a, b) => b.pnlPct - a.pnlPct)
    .slice(0, 5)

  if (winners.length === 0) return null

  const losers = [...holdings]
    .filter(h => h.pnlPct < 0)
    .sort((a, b) => a.pnlPct - b.pnlPct)

  const maxPct = Math.max(...winners.map(h => h.pnlPct), 0.01)

  return (
    <div style={{ margin: '0 16px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Top performers · profit margin
      </div>
      <div className="card" style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 192 }}>
          {winners.map((h, i) => {
            const barH = Math.max((h.pnlPct / maxPct) * 144, 4)
            return (
              <div
                key={h.symbol}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
              >
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--green)', marginBottom: 6, letterSpacing: '-0.2px', textAlign: 'center', fontWeight: 600,
                  animation: 'fade-up 0.5s ease-out both',
                  animationDelay: `${i * 100 + 200}ms`,
                }}>
                  GHS +{fmt(h.unrealizedPnL)}
                </div>
                <div style={{
                  width: '100%',
                  height: barH,
                  borderRadius: '4px 4px 2px 2px',
                  background: 'linear-gradient(180deg, #5BE38C 0%, rgba(91,227,140,0.35) 100%)',
                  flexShrink: 0,
                  transformOrigin: 'bottom',
                  animation: `bar-grow 0.75s cubic-bezier(0.22,1,0.36,1) both`,
                  animationDelay: `${i * 100}ms`,
                }} />
                <div className="mono" style={{
                  fontSize: 12, color: '#FFFFFF', marginTop: 8, fontWeight: 700, letterSpacing: '0.5px',
                  animation: 'fade-up 0.5s ease-out both',
                  animationDelay: `${i * 100 + 250}ms`,
                }}>
                  {h.symbol}
                </div>
              </div>
            )
          })}
        </div>

        {losers.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12,
            paddingTop: 10, borderTop: '1px solid var(--divider)',
          }}>
            <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'Manrope, system-ui, sans-serif', alignSelf: 'center', marginRight: 2 }}>
              In the red:
            </span>
            {losers.map(h => (
              <span
                key={h.symbol}
                className="mono"
                style={{
                  fontSize: 10, color: 'var(--dim)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px',
                }}
              >
                {h.symbol} {h.pnlPct.toFixed(1)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
