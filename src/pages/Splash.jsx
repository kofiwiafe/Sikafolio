import Logo from '../components/Logo'
import { useGoogleLogin } from '@react-oauth/google'

const features = [
  { icon: 'ti-mail',       title: 'Auto-import from Gmail',    sub: 'iC Securities confirmations synced instantly' },
  { icon: 'ti-trending-up', title: 'Live GSE prices',          sub: 'Real-time PnL on every position'             },
  { icon: 'ti-calculator',  title: 'Weighted average cost',    sub: 'Accurate across all your periodic buys'      },
]

export default function Splash({ onEnter }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <Logo size="lg" />

      <p style={{ fontSize: 13, color: '#445', marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>
        Your Ghana Stock Exchange portfolio,<br />tracked automatically from Gmail.
      </p>

      <div style={{ width: '100%', height: 1, background: '#1e2530', margin: '28px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
        {features.map(f => (
          <div key={f.title} style={{
            display: 'flex', alignItems: 'center', gap: 13,
            background: '#131820', border: '0.5px solid #1e2530',
            borderRadius: 12, padding: '11px 14px',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(200,168,75,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i className={`ti ${f.icon}`} style={{ fontSize: 16, color: '#C8A84B' }} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>{f.title}</div>
              <div style={{ fontSize: 11, color: '#445', marginTop: 1 }}>{f.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onEnter}
        style={{
          marginTop: 32, width: '100%', maxWidth: 340,
          padding: 14, background: '#C8A84B',
          border: 'none', borderRadius: 14,
          fontFamily: 'Syne, sans-serif',
          fontSize: 15, fontWeight: 700,
          color: '#0d1117', cursor: 'pointer',
          letterSpacing: '-0.01em',
        }}
      >
        Open portfolio →
      </button>

      <p style={{ fontSize: 11, color: '#334', marginTop: 16, textAlign: 'center' }}>
        Connect Gmail in Settings to enable auto-import
      </p>
    </div>
  )
}
