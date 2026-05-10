const STEPS = [
  'Connecting to Gmail',
  'Scanning noreply@ic.africa',
  'Parsing confirmations',
  'Fetching live prices',
  'Updating PnL',
]

export default function SyncPanel({ progress, tradeCount, emailCount }) {
  const currentStep = STEPS.indexOf(
    STEPS.find(s => progress?.step?.toLowerCase().includes(s.toLowerCase().split(' ')[0]))
  )
  const activeIdx = currentStep === -1 ? (progress?.done ? 5 : 0) : currentStep

  return (
    <div style={{
      margin: '0 12px 12px',
      background: '#131820',
      border: '0.5px solid #1e2530',
      borderRadius: 14,
      padding: 15,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#C8A84B', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="ti ti-mail" style={{ fontSize: 14 }} aria-hidden="true" />
        Gmail sync pipeline
      </div>

      {STEPS.map((step, i) => {
        const done   = i < activeIdx || progress?.done
        const active = i === activeIdx && !progress?.done
        const color  = done ? '#999' : active ? '#2ecc71' : '#778'
        const dotBg  = done ? '#C8A84B' : active ? '#2ecc71' : '#1e2530'

        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: dotBg,
              border: (!done && !active) ? '1px solid #2a3040' : 'none',
              animation: active ? 'blink 1.2s infinite' : 'none',
            }} />
            <span style={{ fontSize: 12, color, flex: 1 }}>{step}</span>
            <span className="mono" style={{ fontSize: 11, color: '#445' }}>
              {done && i === 1 && emailCount ? `${emailCount} emails` : ''}
              {done && i === 2 && tradeCount ? `${tradeCount} trades` : ''}
              {done && i === 0 ? '✓' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
