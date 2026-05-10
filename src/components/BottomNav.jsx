const tabs = [
  { id: 'portfolio', icon: 'ti-chart-pie',   label: 'Portfolio' },
  { id: 'trades',    icon: 'ti-history',      label: 'Trades'    },
  { id: 'markets',   icon: 'ti-trending-up',  label: 'Markets'   },
  { id: 'settings',  icon: 'ti-settings',     label: 'Settings'  },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-btn ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-label={tab.label}
        >
          <i className={`ti ${tab.icon}`} aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
