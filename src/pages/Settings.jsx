import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'
import Logo from '../components/Logo'
import ConfirmCodeModal from '../components/ConfirmCodeModal'

export default function Settings({ user, onLogout }) {
  const [confirmClear, setConfirmClear] = useState(false)

  const trades = useLiveQuery(() => db.trades.count(), [])

  async function clearAllTrades() {
    await db.trades.clear()
    await db.syncMeta.delete('lastSyncDate')
    setConfirmClear(false)
  }

  const rows = (section, items) => (
    <div key={section}>
      <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 20px 6px' }}>
        {section}
      </div>
      {items.map(item => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 20px',
          borderBottom: '1px solid var(--divider)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{item.label}</div>
            {item.sub && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{item.sub}</div>}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>{item.value}</div>
        </div>
      ))}
    </div>
  )

  return (
    <>
    {confirmClear && (
      <ConfirmCodeModal
        title="Clear all portfolio data"
        subtitle="This permanently deletes all trade records in the app. Your data on iC Wealth is not affected."
        destructive
        onVerified={clearAllTrades}
        onCancel={() => setConfirmClear(false)}
      />
    )}
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '10px 20px 14px' }}>
        <Logo />
      </div>

      {/* User avatar */}
      <div style={{ padding: '4px 20px 20px', textAlign: 'center' }}>
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px', display: 'block' }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'var(--bg)',
            margin: '0 auto 8px',
          }}>
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{user?.name || 'User'}</div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{user?.email || ''}</div>
      </div>

      {rows('Prices', [
        { label: 'Price source',  sub: 'afx.kwayisi.org · free',   value: 'GSE API' },
        { label: 'Refresh',       sub: 'Pauses outside market hrs', value: '5 min'  },
        { label: 'Market hours',  sub: 'Mon–Fri 10:00–15:00 GMT',   value: 'GSE'    },
      ])}

      {rows('Display', [
        { label: 'Currency',    value: 'GHS'  },
        { label: 'Cost method', sub: 'Weighted average across all buys', value: 'WAC' },
        { label: 'Trades',      value: String(trades || 0) },
        { label: 'App version', value: '1.0.0' },
      ])}

      {/* Data section */}
      <div style={{ padding: '14px 20px 6px', fontSize: 10, color: 'var(--dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Data</div>
      <div style={{ padding: '4px 20px 0' }}>
        <button
          onClick={() => setConfirmClear(true)}
          style={{
            width: '100%', padding: 12,
            background: 'var(--red-dim)',
            border: '1px solid var(--red-border)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-ui)', fontSize: 13,
            color: 'var(--red)', cursor: 'pointer',
          }}
        >
          Clear all portfolio data
        </button>
      </div>

      {/* Sign out */}
      <div style={{ padding: '12px 20px 0' }}>
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: 12,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-ui)', fontSize: 13,
            color: 'var(--dim)', cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
    </>
  )
}
