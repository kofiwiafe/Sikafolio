import CompanyLogo from './CompanyLogo'
import { getCompany } from '../constants/gseCompanies'

function abbreviateName(name, maxLen = 22) {
  if (!name || name.length <= maxLen) return name
  const rules = [
    [/\bLimited\b/g, 'Ltd'],
    [/\bCorporation\b/g, 'Corp.'],
    [/\bCompany\b/g, 'Co.'],
    [/\bPlantation\b/g, 'Pltn.'],
    [/\bDevelopment\b/g, 'Dev.'],
    [/\bTransnational\b/g, 'Transntl.'],
    [/\bDepository\b/g, 'Dep.'],
    [/\bInternational\b/g, 'Intl.'],
    [/\bAssociated\b/g, 'Assoc.'],
    [/\bFinancial\b/g, 'Fin.'],
  ]
  let result = name
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement)
    if (result.length <= maxLen) return result
  }
  return result.length > maxLen ? result.slice(0, maxLen - 1) + '…' : result
}

export default function StockCard({ holding }) {
  const { symbol, netShares, currentPrice, currentValue,
          unrealizedPnL, pnlPct, changePercent } = holding

  const isUp  = unrealizedPnL >= 0
  const dayUp = changePercent >= 0

  const fmt = (n) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const companyName = abbreviateName(getCompany(symbol).name)

  const accentBar = {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    background: isUp
      ? 'linear-gradient(180deg, #5BE38C, rgba(91,227,140,0.33))'
      : 'linear-gradient(180deg, #FF8E8A, rgba(255,142,138,0.33))',
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={accentBar} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 6 }}>

        {/* Left: logo + ticker + shares + company on top, P&L below */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <CompanyLogo symbol={symbol} size="md" />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', lineHeight: 1.2 }}>{symbol}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {netShares.toLocaleString()}
                  <span style={{ fontSize: 10, color: 'var(--dim)', fontWeight: 400, marginLeft: 3 }}>shares</span>
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.2 }}>{companyName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&L</div>
            <div className="mono" style={{ fontSize: 11, color: isUp ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
              {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{fmt(unrealizedPnL)}
            </div>
            <div className="mono" style={{ fontSize: 10, color: isUp ? 'var(--green)' : 'var(--red)' }}>
              ({isUp ? '+' : ''}{pnlPct.toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* Middle: market value */}
        <div style={{ textAlign: 'center', width: 110, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Current value
          </div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(currentValue)}</div>
        </div>

        {/* Right: current price + daily change */}
        <div style={{ textAlign: 'right', width: 100, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.05em', marginBottom: 2, textTransform: 'uppercase' }}>
            Current price
          </div>
          <div className="mono" style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(currentPrice)}</div>
          <div className="mono" style={{ fontSize: 11, color: dayUp ? 'var(--green)' : 'var(--red)', marginTop: 3, whiteSpace: 'nowrap' }}>
            {dayUp ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
          </div>
        </div>

      </div>
    </div>
  )
}
