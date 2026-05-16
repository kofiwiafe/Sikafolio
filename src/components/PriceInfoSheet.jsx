import { useEffect } from 'react'

export default function PriceInfoSheet({ open, onClose, updatedAt }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 199,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          background: 'var(--surface-solid)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '24px 20px',
          animation: 'modal-in 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          About price data
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, margin: '0 0 12px' }}>
          Prices shown are <strong style={{ color: 'var(--text)' }}>official GSE closing prices</strong>, published once after each trading session ends (15:00 GMT, Mon–Fri).
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, margin: '0 0 20px' }}>
          Broker apps like IC Wealth show the <strong style={{ color: 'var(--text)' }}>last traded price</strong> from their live feed — a structural difference, not an error.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          marginBottom: 20,
        }}>
          <i className="ti ti-database" style={{ fontSize: 15, color: 'var(--dim)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Source</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>afx.kwayisi.org · GSE official data</div>
          </div>
          {updatedAt && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', flexShrink: 0 }}>
              Updated {updatedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '13px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            fontFamily: 'var(--font-ui)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
