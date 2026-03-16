import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Lobby() {
  const [name, setName] = useState('')
  const [caseCode, setCaseCode] = useState('')
  const [mode, setMode] = useState('create') // create | join
  const navigate = useNavigate()

  // Clear previous session when landing on lobby
  useEffect(() => {
    localStorage.removeItem('currentSessionId')
    localStorage.removeItem('currentWitnessId')
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    const session = await api.createSession(name)
    localStorage.setItem('playerId', session.players[0].player_id)
    localStorage.setItem('playerName', name)
    localStorage.setItem('currentSessionId', session.session_id)
    navigate(`/case/${session.session_id}`)
  }

  const handleJoin = async () => {
    if (!name.trim() || !caseCode.trim()) return
    const player = await api.joinSession(caseCode, name)
    localStorage.setItem('playerId', player.player_id)
    localStorage.setItem('playerName', name)
    localStorage.setItem('currentSessionId', caseCode)
    navigate(`/case/${caseCode}`)
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-badge">GEMINI LIVE AGENT CHALLENGE</div>
        <h1>The Witness</h1>
        <p className="tagline">
          A scientist is dead. Three people were in the building.
          Each is an AI agent with a secret. You have 20 minutes.
        </p>

        <div className="case-briefing">
          <div className="briefing-label">Case Briefing</div>
          <div className="briefing-text">
            Dr. Shalini Deshmukh, a prominent biochemist, was found dead in her locked laboratory
            at IISc Bangalore at midnight. No signs of forced entry. Three people were in the building
            that night — her colleague, her lab assistant, and the security guard. Each has a story.
            Each has something to hide. The police have no leads. You have 20 minutes before the
            prime suspect walks free.
          </div>
        </div>

        <div className="lobby-suspects">
          <div className="suspect-preview">
            <span className="suspect-emoji">👩‍🔬</span>
            <span className="suspect-label">The Colleague</span>
          </div>
          <div className="suspect-preview">
            <span className="suspect-emoji">🧑‍🔧</span>
            <span className="suspect-label">The Assistant</span>
          </div>
          <div className="suspect-preview">
            <span className="suspect-emoji">💂</span>
            <span className="suspect-label">The Guard</span>
          </div>
        </div>

        <div className="lobby-form">
          <input
            type="text"
            placeholder="Your name, detective"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && mode === 'create' && handleCreate()}
          />

          {mode === 'create' ? (
            <>
              <button className="btn btn-primary" onClick={handleCreate}>
                🔍 Start new case
              </button>
              <button className="btn btn-ghost" onClick={() => setMode('join')}>
                Join existing case
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Case code"
                value={caseCode}
                onChange={(e) => setCaseCode(e.target.value.toUpperCase())}
                className="code-input"
              />
              <button className="btn btn-primary" onClick={handleJoin}>
                Join case
              </button>
              <button className="btn btn-ghost" onClick={() => setMode('create')}>
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
