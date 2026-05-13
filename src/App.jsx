import { useState } from 'react'
import Splash from './pages/Splash'
import Portfolio from './pages/Portfolio'
import Trades from './pages/Trades'
import Markets from './pages/Markets'
import News from './pages/News'
import Settings from './pages/Settings'
import BottomNav from './components/BottomNav'
import { usePrices } from './hooks/usePrices'

const SESSION_KEY = 'sikafolio_session'

function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export default function App() {
  const [user, setUser] = useState(getStoredSession)
  const [screen, setScreen] = useState(() => getStoredSession() ? 'portfolio' : 'splash')
  const prices = usePrices()

  function handleLogin(userInfo) {
    const profile = { email: userInfo.email, name: userInfo.name, avatar: userInfo.avatar }
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile))
    setUser(profile)
    setScreen('portfolio')
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
    setScreen('splash')
  }

  if (screen === 'splash') {
    return <Splash onEnter={handleLogin} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'portfolio' && <Portfolio prices={prices} user={user} />}
        {screen === 'trades'    && <Trades prices={prices} />}
        {screen === 'markets'   && <Markets prices={prices} />}
        {screen === 'news'      && <News />}
        {screen === 'settings'  && (
          <Settings
            user={user}
            onLogout={handleLogout}
          />
        )}
      </div>
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  )
}
