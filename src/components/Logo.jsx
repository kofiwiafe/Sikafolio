export default function Logo({ size = 'md' }) {
  const iconSize = size === 'lg' ? 36 : 16
  const boxSize  = size === 'lg' ? 72 : 30
  const textSize = size === 'lg' ? 32 : 17

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'lg' ? 0 : 8, flexDirection: size === 'lg' ? 'column' : 'row' }}>
      <div style={{
        width: boxSize, height: boxSize,
        borderRadius: size === 'lg' ? 22 : 9,
        background: '#C8A84B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: size === 'lg' ? 16 : 0,
        flexShrink: 0,
      }}>
        <i className="ti ti-coin" style={{ fontSize: iconSize, color: '#0d1117' }} aria-hidden="true" />
      </div>
      <div style={{ fontSize: textSize, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em', textAlign: 'center' }}>
        Sika<span style={{ color: '#C8A84B' }}>Folio</span>
      </div>
    </div>
  )
}
