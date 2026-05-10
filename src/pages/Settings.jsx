import { useGoogleLogin } from '@react-oauth/google'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../services/db'
import Logo from '../components/Logo'

export default function Settings({ accessToken, onLogin }) {
  const trades   = useLiveQuery(() => db.trades.count(), [])
  const syncMeta = useLiveQuery(() => db.syncMeta.get('lastSyncDate'), [])

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    onSuccess: (res) => onLogin(res.access_token),
    onError:   ()    => alert('Gmail login failed. Check your OAuth setup.'),
  })

  const rows = (section, items) => (
    <div key={section}>
      <div style={{ fontSize: 10, color: '#445', letterSpacing: '0.06em', padding: '14px 20px 6px' }}>{section}</div>
      {items.map(item => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 20px',
          borderBottom: '0.5px solid #131820',
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#ccc' }}>{item.label}</div>
            {item.sub && <div style={{ fontSize: 11, color: '#445', marginTop: 2 }}>{item.sub}</div>}
          </div>
          <div className="mono" style={{ fontSize: 12, color: '#C8A84B' }}>{item.value}</div>
        </div>
      ))}
    </div>
  )

  const lastSync = syncMeta?.value
    ? new Date(syncMeta.value).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
    : 'Never'

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '10px 20px 14px' }}>
        <Logo />
      </div>

      <div style={{ padding: '4px 20px 20px', textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#C8A84B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#0d1117',
          margin: '0 auto 8px',
        }}>SWA</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#ddd' }}>Sylvester Wiafe Asare</div>
        <div style={{ fontSize: 11, color: '#445', marginTop: 2 }}>
          {accessToken ? 'Gmail connected' : 'Gmail not connected'}
        </div>
      </div>

      {!accessToken && (
        <div style={{ padding: '0 20px 16px' }}>
          <button
            onClick={() => login()}
            style={{
              width: '100%', padding: '13px',
              background: '#C8A84B', border: 'none', borderRadius: 12,
              fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600,
              color: '#0d1117', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <i className="ti ti-brand-google" style={{ fontSize: 18 }} aria-hidden="true" />
            Connect Gmail account
          </button>
          <p style={{ fontSize: 11, color: '#334', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
            Read-only access · Only scans noreply@ic.africa emails
          </p>
        </div>
      )}

      {rows('Gmail sync', [
        { label: 'Status',        sub: 'noreply@ic.africa filter', value: accessToken ? 'Connected' : 'Not connected' },
        { label: 'Auto-sync',     sub: 'Checks every 30 min',      value: accessToken ? 'On' : 'Off' },
        { label: 'Last scan',     sub: `${trades || 0} trades total`, value: lastSync },
      ])}

      {rows('Prices', [
        { label: 'Price source',  sub: 'afx.kwayisi.org · free',   value: 'GSE API' },
        { label: 'Refresh',       sub: 'Pauses outside market hrs', value: '5 min'  },
        { label: 'Market hours',  sub: 'Mon–Fri 10:00–15:00 GMT',   value: 'GSE'    },
      ])}

      {rows('Display', [
        { label: 'Currency',      value: 'GHS'  },
        { label: 'Cost method',   sub: 'Weighted average across all buys', value: 'WAC' },
        { label: 'App version',   value: '1.0.0' },
      ])}

      {accessToken && (
        <div style={{ padding: '16px 20px 0' }}>
          <button
            onClick={() => onLogin(null)}
            style={{
              width: '100%', padding: 12,
              background: 'rgba(231,76,60,0.08)',
              border: '0.5px solid rgba(231,76,60,0.2)',
              borderRadius: 12,
              fontFamily: 'Syne, sans-serif', fontSize: 13,
              color: '#e74c3c', cursor: 'pointer',
            }}
          >
            Disconnect Gmail
          </button>
        </div>
      )}
    </div>
  )
}
