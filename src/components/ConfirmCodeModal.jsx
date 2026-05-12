import { useMemo, useState } from 'react'

export default function ConfirmCodeModal({ title, subtitle, destructive, onVerified, onCancel }) {
  const code   = useMemo(() => String(Math.floor(1000 + Math.random() * 9000)), [])
  const [typed, setTyped] = useState('')
  const [shake, setShake] = useState(false)

  const accentClr = destructive ? 'var(--red)'  : 'var(--gold)'
  const accentBg  = destructive ? 'var(--red-dim)'    : 'var(--gold-dim)'
  const accentBdr = destructive ? 'var(--red-border)' : 'var(--gold-border)'

  function handleChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setTyped(val)
  }

  function handleConfirm() {
    if (typed === code) {
      onVerified()
    } else {
      setShake(true)
      setTyped('')
      setTimeout(() => setShake(false), 500)
    }
  }

  const matched = typed === code

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0) }
          20%      { transform: translateX(-6px) }
          40%      { transform: translateX(6px) }
          60%      { transform: translateX(-4px) }
          80%      { transform: translateX(4px) }
        }
        .confirm-code-shake { animation: shake 0.45s ease }
      `}</style>

      <div
        style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-end' }}
        onClick={onCancel}
      >
        <div
          style={{ width: '100%', background: 'var(--surface-solid)', borderRadius: '16px 16px 0 0', padding: '24px 20px 44px' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Title */}
          <div style={{ fontSize: 15, fontWeight: 700, color: accentClr, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
            {subtitle}
          </div>

          {/* Code display */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
              Type this code to confirm
            </div>
            <div style={{
              display: 'inline-flex', gap: 10, padding: '10px 16px',
              background: accentBg,
              border: `1px solid ${accentBdr}`,
              borderRadius: 'var(--r-sm)',
            }}>
              {code.split('').map((digit, i) => (
                <span
                  key={i}
                  className="mono"
                  style={{ fontSize: 28, fontWeight: 600, letterSpacing: 2, color: accentClr, lineHeight: 1 }}
                >
                  {digit}
                </span>
              ))}
            </div>
          </div>

          {/* Input */}
          <input
            className={shake ? 'confirm-code-shake' : ''}
            type="text"
            inputMode="numeric"
            placeholder="_ _ _ _"
            value={typed}
            onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            autoFocus
            maxLength={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg)',
              border: `1px solid ${shake ? 'var(--red)' : matched && typed.length === 4 ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: 'var(--r-sm)', padding: '12px 14px',
              fontSize: 22, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: 'var(--text)', letterSpacing: '0.35em',
              outline: 'none', textAlign: 'center',
              marginBottom: 16,
              transition: 'border-color 0.15s',
            }}
          />

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: 12, borderRadius: 'var(--r-md)', cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', fontSize: 13, fontFamily: 'var(--font-ui)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!matched}
              style={{
                flex: 2, padding: 12, borderRadius: 'var(--r-md)', fontWeight: 600,
                cursor: matched ? 'pointer' : 'default',
                background: accentBg,
                border: `1px solid ${accentBdr}`,
                color: accentClr, fontSize: 13, fontFamily: 'var(--font-ui)',
                opacity: matched ? 1 : 0.35,
                transition: 'opacity 0.15s',
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
