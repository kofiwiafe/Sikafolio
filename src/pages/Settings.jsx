import { useState } from 'react'
import Logo from '../components/Logo'
import ConfirmCodeModal from '../components/ConfirmCodeModal'


function ComingSoonModal({ title, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          background: 'var(--surface-solid)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '28px 24px',
          textAlign: 'center',
          animation: 'modal-in 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(240,194,94,0.1)',
          border: '1px solid rgba(240,194,94,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <i className="ti ti-clock" style={{ fontSize: 22, color: 'var(--gold)' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 24 }}>
          This feature is coming soon. We're working on direct broker integration
          to make importing trades even easier.
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '13px 0',
            background: 'linear-gradient(180deg, #F0C25E 0%, #C99A38 100%)',
            border: 'none', borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600,
            color: '#080A10', cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ label }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--dim)',
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '18px 20px 6px',
    }}>
      {label}
    </div>
  )
}

function SettingsRow({ icon, label, sub, value, valueColor, onClick, chevron = false, danger = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '13px 20px',
        borderBottom: '1px solid var(--divider)',
        cursor: onClick ? 'pointer' : 'default',
        gap: 12,
      }}
    >
      {icon && (
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: danger ? 'rgba(255,142,138,0.1)' : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: danger ? 'var(--red)' : 'var(--muted)' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: danger ? 'var(--red)' : 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{sub}</div>}
      </div>
      {value !== undefined && (
        <div className="mono" style={{ fontSize: 12, color: valueColor || 'var(--gold)', flexShrink: 0 }}>
          {value}
        </div>
      )}
      {chevron && (
        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--dim)', flexShrink: 0 }} />
      )}
    </div>
  )
}

function exportCSV(trades) {
  const header = 'Date,Symbol,Type,Quantity,Gross (GHS),Fee (GHS),Net (GHS),Price/Share,Order Number,Source'
  const rows = trades.map(t => [
    (t.executionDate || '').slice(0, 10),
    t.symbol,
    t.orderType,
    t.quantity,
    t.grossConsideration,
    t.processingFee,
    t.netConsideration,
    t.pricePerShare,
    t.orderNumber || '',
    t.source || '',
  ].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sikafolio-trades-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Settings({ user, onLogout, trades, clearAllTrades, refetchTrades }) {
  const [confirmClear, setConfirmClear]     = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)

  const tradeCount = trades?.length ?? 0

  async function handleClearAll() {
    await clearAllTrades()
    setConfirmClear(false)
  }

  return (
    <>
      {confirmClear && (
        <ConfirmCodeModal
          title="Clear all portfolio data"
          subtitle="This permanently deletes all trade records in the app. Your data on iC Wealth is not affected."
          destructive
          onVerified={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {showComingSoon && (
        <ComingSoonModal title="iC Securities Direct Sync" onClose={() => setShowComingSoon(false)} />
      )}

      <div style={{ paddingBottom: 32 }}>
        <div style={{ padding: '10px 20px 14px' }}>
          <Logo />
        </div>

        {/* User profile */}
        <div style={{ padding: '4px 20px 20px', textAlign: 'center' }}>
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: 'var(--bg)',
              margin: '0 auto 10px',
            }}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{user?.name || 'User'}</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3 }}>{user?.email || ''}</div>
        </div>

        {/* iC Securities */}
        <SectionHeader label="iC Securities" />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', margin: '0 16px' }}>
          <SettingsRow
            icon="ti-building-bank"
            label="Direct broker sync"
            sub="Connect your iC Wealth account"
            chevron
            onClick={() => setShowComingSoon(true)}
          />
          <SettingsRow
            icon="ti-file-import"
            label="Import from statement"
            sub="Upload a CSV or PDF statement"
            chevron
            onClick={() => setShowComingSoon(true)}
          />
        </div>

        {/* Data */}
        <SectionHeader label="Data" />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', margin: '0 16px' }}>
          <SettingsRow
            icon="ti-download"
            label="Export trades"
            sub="Download all trades as CSV"
            chevron
            onClick={() => trades?.length && exportCSV(trades)}
            value={tradeCount > 0 ? `${tradeCount} trades` : undefined}
            valueColor="var(--muted)"
          />
          <SettingsRow
            icon="ti-bell"
            label="Notifications"
            sub="Price alerts and sync reminders"
            value="Soon"
            valueColor="var(--dim)"
          />
          <SettingsRow
            icon="ti-trash"
            label="Clear all portfolio data"
            sub="Permanently deletes all trade records"
            danger
            onClick={() => setConfirmClear(true)}
          />
        </div>

        {/* Sign out */}
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%', padding: 13,
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

        {/* About footer */}
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>SikaFolio v1.0.0</span>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>Prices: afx.kwayisi.org · GSE</span>
        </div>
      </div>
    </>
  )
}
