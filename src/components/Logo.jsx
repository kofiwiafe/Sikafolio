import logoImg from '../assets/logo.jpg'

export default function Logo({ size = 'md' }) {
  const boxSize  = size === 'lg' ? 72 : 30
  const textSize = size === 'lg' ? 32 : 17

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'lg' ? 0 : 8, flexDirection: size === 'lg' ? 'column' : 'row' }}>
      <div style={{
        width: boxSize, height: boxSize,
        borderRadius: size === 'lg' ? 22 : 9,
        background: '#F0C25E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: size === 'lg' ? 16 : 0,
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <img
          src={logoImg}
          alt="SikaFolio logo"
          style={{ width: '80%', height: '80%', objectFit: 'contain', mixBlendMode: 'multiply' }}
        />
      </div>
      <div style={{ fontSize: textSize, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', textAlign: 'center' }}>
        Sika<span style={{ color: 'var(--gold)' }}>Folio</span>
      </div>
    </div>
  )
}
