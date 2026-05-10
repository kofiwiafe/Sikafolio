import { useState } from 'react'
import Splash from './pages/Splash'
import Portfolio from './pages/Portfolio'
import Trades from './pages/Trades'
import Markets from './pages/Markets'
import Settings from './pages/Settings'
import BottomNav from './components/BottomNav'
import { usePrices } from './hooks/usePrices'

export default function App() {
  const [screen, setScreen] = useState('splash')
  const [accessToken, setAccessToken] = useState(null)
  const prices = usePrices()

  if (screen === 'splash') {
    return <Splash onEnter={() => setScreen('portfolio')} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'portfolio' && <Portfolio prices={prices} />}
        {screen === 'trades'    && <Trades accessToken={accessToken} />}
        {screen === 'markets'   && <Markets prices={prices} />}
        {screen === 'settings'  && <Settings accessToken={accessToken} onLogin={setAccessToken} />}
      </div>
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  )
}
