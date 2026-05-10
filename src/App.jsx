import { useState, useEffect, useRef } from 'react'
import Splash from './pages/Splash'
import Portfolio from './pages/Portfolio'
import Trades from './pages/Trades'
import Markets from './pages/Markets'
import Settings from './pages/Settings'
import BottomNav from './components/BottomNav'
import { usePrices } from './hooks/usePrices'
import { syncTrades } from './services/gmailService'

const SESSION_KEY   = 'sikafolio_session'
const GMAIL_KEY     = 'sikafolio_gmail_email'

function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export default function App() {
  const [user, setUser] = useState(getStoredSession)
  const [screen, setScreen] = useState(() => getStoredSession() ? 'portfolio' : 'splash')
  const [accessToken, setAccessToken] = useState(null)
  const [gmailEmail, setGmailEmail]   = useState(() => localStorage.getItem(GMAIL_KEY) || null)
  const [syncTrigger, setSyncTrigger] = useState(0)
  const prices = usePrices()
  const lastAutoSyncKey = useRef(null)

  // Silent background sync at 6am and 12pm while the app is open
  useEffect(() => {
    if (!accessToken) return
    const id = setInterval(() => {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      if ((h === 6 || h === 12) && m === 0) {
        const key = `${now.toDateString()}-${h}`
        if (lastAutoSyncKey.current !== key) {
          lastAutoSyncKey.current = key
          syncTrades(accessToken, null).catch(() => {})
        }
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [accessToken])

  function handleLogin(userInfo) {
    const profile = { email: userInfo.email, name: userInfo.name, avatar: userInfo.avatar }
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile))
    setUser(profile)
    if (userInfo.accessToken) setAccessToken(userInfo.accessToken)
    setScreen('portfolio')
  }

  function handleGmailConnect(info) {
    if (!info) {
      setAccessToken(null)
      setGmailEmail(null)
      localStorage.removeItem(GMAIL_KEY)
    } else {
      setAccessToken(info.accessToken)
      setGmailEmail(info.gmailEmail)
      if (info.gmailEmail) localStorage.setItem(GMAIL_KEY, info.gmailEmail)
      setSyncTrigger(t => t + 1)
      setScreen('trades')
    }
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(GMAIL_KEY)
    setUser(null)
    setAccessToken(null)
    setGmailEmail(null)
    setScreen('splash')
  }

  if (screen === 'splash') {
    return <Splash onEnter={handleLogin} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'portfolio' && <Portfolio prices={prices} />}
        {screen === 'trades'    && <Trades accessToken={accessToken} gmailEmail={gmailEmail} syncTrigger={syncTrigger} />}
        {screen === 'markets'   && <Markets prices={prices} />}
        {screen === 'settings'  && (
          <Settings
            user={user}
            accessToken={accessToken}
            gmailEmail={gmailEmail}
            onLogin={handleGmailConnect}
            onLogout={handleLogout}
          />
        )}
      </div>
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  )
}
