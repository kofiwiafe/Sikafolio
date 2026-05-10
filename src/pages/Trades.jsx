import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'
import { syncTrades } from '../services/gmailService'
import SyncPanel from '../components/SyncPanel'
import Logo from '../components/Logo'
import AddTradeModal from '../components/AddTradeModal'

export default function Trades({ accessToken }) {
  const [syncing, setSyncing]       = useState(false)
  const [progress, setProgress]     = useState(null)
  const [emailCount, setEmailCount] = useState(null)
  const [tradeCount, setTradeCount] = useState(null)
  const [showAdd, setShowAdd]       = useState(false)

  const trades = useLiveQuery(() =>
    db.trades.orderBy('executionDate').reverse().toArray(), []
  )

  async function handleSync() {
    if (!accessToken) {
      alert('Connect Gmail in Settings first.')
      return
    }
    setSyncing(true)
    setProgress(null)
    await syncTrades(accessToken, (p) => {
      setProgress(p)
      if (p.count && p.step.includes('emails')) setEmailCount(p.count)
      if (p.count && p.step.includes('trades')) setTradeCount(p.count)
    })
    setSyncing(false)
  }

  // Group trades by month
  const grouped = {}
  for (const t of (trades || [])) {
    const date  = new Date(t.executionDate)
    const label = date.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(t)
  }

  const fmt = (n) => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
    {showAdd && <AddTradeModal onClose={() => setShowAdd(false)} />}
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
        <Logo />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(200,168,75,0.12)',
              border: '0.5px solid rgba(200,168,75,0.3)',
              borderRadius: 20, padding: '6px 13px',
              fontSize: 12, color: '#C8A84B', cursor: 'pointer',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
            Add Trade
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: syncing ? '#131820' : 'rgba(200,168,75,0.12)',
              border: '0.5px solid rgba(200,168,75,0.3)',
              borderRadius: 20, padding: '6px 13px',
              fontSize: 12, color: '#C8A84B', cursor: 'pointer',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            <i className={`ti ti-refresh ${syncing ? 'spin' : ''}`} style={{ fontSize: 14 }} aria-hidden="true" />
            {syncing ? 'Syncing…' : 'Sync Gmail'}
          </button>
        </div>
      </div>

      {(syncing || progress) && (
        <SyncPanel progress={progress} emailCount={emailCount} tradeCount={tradeCount} />
      )}

      {!syncing && !progress && !accessToken && (
        <div style={{
          margin: '0 12px 12px',
          background: 'rgba(200,168,75,0.07)',
          border: '0.5px solid rgba(200,168,75,0.2)',
          borderRadius: 12, padding: '11px 14px',
          fontSize: 12, color: '#C8A84B', lineHeight: 1.6,
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: 14, marginRight: 7 }} aria-hidden="true" />
          Connect Gmail in <strong>Settings</strong> to auto-import your iC Securities trade confirmations.
        </div>
      )}

      {Object.entries(grouped).length === 0 && !syncing ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#445', fontSize: 13, lineHeight: 1.7 }}>
          No trades yet.<br />
          Tap <strong style={{ color: '#C8A84B' }}>Add Trade</strong> to enter one manually,<br />
          or <strong style={{ color: '#C8A84B' }}>Sync Gmail</strong> to auto-import.
        </div>
      ) : (
        Object.entries(grouped).map(([month, list]) => (
          <div key={month}>
            <div style={{ fontSize: 10, color: '#445', letterSpacing: '0.05em', padding: '12px 20px 4px' }}>
              {month}
            </div>
            {list.map(t => {
              const isBuy = t.orderType === 'Buy'
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 20px',
                  borderBottom: '0.5px solid #131820',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: isBuy ? 'rgba(200,168,75,0.1)' : 'rgba(231,76,60,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={`ti ti-arrow-${isBuy ? 'down' : 'up'}`}
                       style={{ fontSize: 16, color: isBuy ? '#C8A84B' : '#e74c3c' }}
                       aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#C8A84B' }}>{t.symbol}</div>
                    <div style={{ fontSize: 11, color: '#445', marginTop: 1 }}>
                      {t.quantity} shares @ GHS {fmt(t.pricePerShare)}
                    </div>
                    <SourceBadge source={t.source} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 13, color: '#ddd' }}>GHS {fmt(t.netConsideration)}</div>
                    <div style={{ fontSize: 10, color: '#445', marginTop: 2 }}>
                      Settled {t.settlementDate || '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
    </>
  )
}

function SourceBadge({ source }) {
  const cfg = {
    gmail:  { icon: 'ti-mail',     label: 'Auto-imported' },
    paste:  { icon: 'ti-clipboard', label: 'Pasted email' },
    manual: { icon: 'ti-pencil',   label: 'Manual entry' },
  }[source] ?? { icon: 'ti-mail', label: 'Auto-imported' }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3,
      fontSize: 10, color: '#C8A84B',
      background: 'rgba(200,168,75,0.07)',
      border: '0.5px solid rgba(200,168,75,0.15)',
      borderRadius: 4, padding: '1px 5px',
    }}>
      <i className={`ti ${cfg.icon}`} style={{ fontSize: 10 }} aria-hidden="true" />
      {cfg.label}
    </div>
  )
}
