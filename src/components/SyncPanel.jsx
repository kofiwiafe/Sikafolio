const STEPS = [
  'Connecting to Gmail',
  'Scanning inbox',
  'Parsing confirmations',
  'Fetching live prices',
  'Updating PnL',
]

export default function SyncPanel({ progress, gmailEmail }) {
  const stepMap = {
    'connecting': 0,
    'scanning':   1,
    'parsing':    2,
    'fetching':   3,
    'updating':   4,
  }
  const activeIdx = progress?.done
    ? 5
    : (stepMap[progress?.step?.toLowerCase().split(' ')[0]] ?? 0)

  const emailCount = progress?.emailCount ?? progress?.count
  const tradeCount = progress?.tradeCount ?? progress?.parsed

  return (
    <div style={{
      margin: '0 12px 12px',
      background: '#131820',
      border: '0.5px solid #1e2530',
      borderRadius: 14,
      padding: 15,
    }}>
      <div style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#C8A84B', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-mail" style={{ fontSize: 14 }} aria-hidden="true" />
          Gmail sync pipeline
        </div>
        {gmailEmail && (
          <div style={{ fontSize: 11, color: '#556', marginTop: 3 }}>{gmailEmail}</div>
        )}
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
              {done && i === 1 && emailCount != null ? `${emailCount} emails` : ''}
              {done && i === 2 && tradeCount != null ? `${tradeCount} new` : ''}
              {done && i === 0 ? '✓' : ''}
            </span>
          </div>
        )
      })}

      {progress?.done && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #1e2530', fontSize: 11, color: '#556', lineHeight: 1.6 }}>
          {tradeCount > 0
            ? `${tradeCount} new trade${tradeCount !== 1 ? 's' : ''} imported from ${emailCount} email${emailCount !== 1 ? 's' : ''}.`
            : emailCount > 0
              ? `${emailCount} email${emailCount !== 1 ? 's' : ''} scanned — no new trades.`
              : <>
                  No emails from <span style={{ color: '#778' }}>noreply@ic.africa</span> found in your inbox or spam.
                  <br />Check that your iC Securities account uses <strong style={{ color: '#667' }}>{gmailEmail}</strong>.
                </>
          }
        </div>
      )}
    </div>
  )
}
