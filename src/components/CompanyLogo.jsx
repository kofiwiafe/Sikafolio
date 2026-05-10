import { useState } from 'react'
import { getCompany } from '../constants/gseCompanies'

const PALETTE = ['#2980b9', '#8e44ad', '#16a085', '#d35400', '#c0392b', '#27ae60', '#7f8c8d', '#e67e22']
function avatarColor(s) {
  return PALETTE[s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]
}

// size: 'sm' = 32px, 'md' = 40px (default), 'lg' = 52px
const SIZES = { sm: 32, md: 40, lg: 52 }
const RADII = { sm: 8,  md: 11, lg: 14 }

export default function CompanyLogo({ symbol, size = 'md' }) {
  const { domain } = getCompany(symbol)
  const [srcIdx, setSrcIdx] = useState(0)

  const px = SIZES[size] ?? SIZES.md
  const r  = RADII[size] ?? RADII.md

  // 1st: Clearbit full logo  2nd: Google S2 favicon (pulled live from company site)
  const sources = domain ? [
    `https://logo.clearbit.com/${domain}?size=${px * 2}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ] : []

  if (sources.length > 0 && srcIdx < sources.length) {
    const isFavicon = srcIdx === 1
    return (
      <img
        src={sources[srcIdx]}
        alt={symbol}
        onError={() => setSrcIdx(i => i + 1)}
        style={{
          width: px, height: px, borderRadius: r, flexShrink: 0,
          objectFit: 'contain',
          background: '#fff',
          padding: isFavicon ? Math.round(px * 0.18) : Math.round(px * 0.09),
          display: 'block',
        }}
      />
    )
  }

  // Final fallback: coloured letter avatar
  return (
    <div style={{
      width: px, height: px, borderRadius: r, flexShrink: 0,
      background: avatarColor(symbol),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(px * 0.3), fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
    }}>
      {symbol.slice(0, 2)}
    </div>
  )
}
