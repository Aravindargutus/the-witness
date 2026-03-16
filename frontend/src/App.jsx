import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Lobby from './pages/Lobby'
import CaseBoard from './pages/CaseBoard'
import Interrogation from './pages/Interrogation'
import ErrorBoundary from './components/ErrorBoundary'

function TabNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  const sessionId = localStorage.getItem('currentSessionId')
  const witnessId = localStorage.getItem('currentWitnessId')

  const tabs = [
    { key: 'lobby', label: 'Screen 1 → Lobby', path: '/' },
    { key: 'case', label: 'Screen 2 → Case Board', path: sessionId ? `/case/${sessionId}` : null },
    { key: 'interrogate', label: 'Screen 3 → Interrogation', path: sessionId && witnessId ? `/interrogate/${sessionId}/${witnessId}` : null },
  ]

  const getActive = () => {
    if (path.startsWith('/interrogate')) return 'interrogate'
    if (path.startsWith('/case')) return 'case'
    return 'lobby'
  }
  const active = getActive()

  return (
    <nav className="tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab-btn ${active === tab.key ? 'active' : ''} ${!tab.path ? 'disabled' : ''}`}
          onClick={() => tab.path && navigate(tab.path)}
          disabled={!tab.path}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TabNav />
      <div className="page-content">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Lobby />} />
            <Route path="/case/:sessionId" element={<CaseBoard />} />
            <Route path="/interrogate/:sessionId/:witnessId" element={<Interrogation />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  )
}
