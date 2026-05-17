import { useState, useMemo } from 'react'
import Splash from './pages/Splash'
import Portfolio from './pages/Portfolio'
import Trades from './pages/Trades'
import Markets from './pages/Markets'
import News from './pages/News'
import Settings from './pages/Settings'
import BottomNav from './components/BottomNav'
import { usePrices } from './hooks/usePrices'
import { useTrades } from './hooks/useTrades'
import { useReports } from './hooks/useReports'

const SESSION_KEY = 'sikafolio_session'
const SCREEN_KEY  = 'sikafolio_screen'

function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export default function App() {
  const [user, setUser]     = useState(getStoredSession)
  const [screen, setScreen] = useState(() => {
    if (!getStoredSession()) return 'splash'
    return localStorage.getItem(SCREEN_KEY) || 'portfolio'
  })

  function navigate(s) {
    localStorage.setItem(SCREEN_KEY, s)
    setScreen(s)
  }
  const prices    = usePrices()
  const tradesApi = useTrades(user?.email)

  const heldSymbols = useMemo(
    () => [...new Set((tradesApi.trades || []).map(t => t.symbol))],
    [tradesApi.trades]
  )
  const { reports, hasNew: hasNewReports, markAllSeen: markReportsSeen } = useReports(heldSymbols)

  function handleLogin(userInfo) {
    const profile = { email: userInfo.email, name: userInfo.name, avatar: userInfo.avatar }
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile))
    setUser(profile)
    navigate('portfolio')
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SCREEN_KEY)
    setUser(null)
    setScreen('splash')
  }

  if (screen === 'splash') {
    return <Splash onEnter={handleLogin} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'portfolio' && (
          <Portfolio
            prices={prices} user={user} trades={tradesApi.trades} tradesLoading={tradesApi.loading}
            hasNewReports={hasNewReports}
            onViewReports={() => navigate('news')}
          />
        )}
        {screen === 'trades' && (
          <Trades
            prices={prices}
            trades={tradesApi.trades}
            tradesLoading={tradesApi.loading}
            updateTrade={tradesApi.updateTrade}
            deleteTrade={tradesApi.deleteTrade}
            addTrades={tradesApi.addTrades}
            checkDuplicate={tradesApi.checkDuplicate}
            user={user}
          />
        )}
        {screen === 'markets'  && <Markets prices={prices} user={user} trades={tradesApi.trades} />}
        {screen === 'news'     && <News trades={tradesApi.trades} reports={reports} markReportsSeen={markReportsSeen} />}
        {screen === 'settings' && (
          <Settings
            user={user}
            onLogout={handleLogout}
            trades={tradesApi.trades}
            clearAllTrades={tradesApi.clearAllTrades}
            refetchTrades={tradesApi.refetch}
          />
        )}
      </div>
      <BottomNav active={screen} onChange={navigate} />
    </div>
  )
}
