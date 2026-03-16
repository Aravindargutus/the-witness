import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ContradictionAlert from '../components/ContradictionAlert'
import VerdictModal from '../components/VerdictModal'
import { useFirestore } from '../hooks/useFirestore'

const WITNESSES = [
  { id: 'meena', name: 'Dr. Meena Krishnan', initials: 'MK', role: 'The Colleague', emoji: '👩‍🔬', color: '#e53935' },
  { id: 'arjun', name: 'Arjun Patel', initials: 'AP', role: 'The Lab Assistant', emoji: '🧑‍🔧', color: '#43a047' },
  { id: 'rajan', name: 'Rajan Kumar', initials: 'RK', role: 'The Guard', emoji: '💂', color: '#ab47bc' },
]

const SUSPECTS = [
  ...WITNESSES,
  { id: 'divya', name: 'Divya Rao', initials: 'DR', role: 'Unknown — Shalini\'s Sister', emoji: '👤', color: '#888' },
]

const WITNESS_NAMES = {
  meena: 'Meena Krishnan',
  arjun: 'Arjun Patel',
  rajan: 'Rajan Kumar',
}

export default function CaseBoard() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { statements, contradictions, players } = useFirestore(sessionId)
  const [showVerdict, setShowVerdict] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20 * 60)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setTimeUp(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const handleInterrogate = (witnessId) => {
    localStorage.setItem('currentWitnessId', witnessId)
    navigate(`/interrogate/${sessionId}/${witnessId}`)
  }

  const playerName = localStorage.getItem('playerName') || 'Detective'

  // Build event log from statements + contradictions
  const eventLog = [
    ...statements.map((s) => ({
      time: new Date(s.timestamp),
      actor: playerName,
      text: `New clue from ${WITNESS_NAMES[s.witness_id] || s.witness_id}`,
    })),
    ...contradictions.map((c) => ({
      time: new Date(c.detected_at),
      actor: 'Contradiction engine',
      text: `${c.topic || 'Conflict'} detected`,
    })),
    { time: new Date(), actor: 'System', text: `Case started · ${Math.max(players.length, 1)} detective${players.length !== 1 ? 's' : ''}` },
  ].sort((a, b) => b.time - a.time)

  const fmtLogTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="cb">
      <div className="cb-main">
        {/* Header */}
        <div className="cb-header">
          <div className="cb-title">
            <span>Live case board</span>
            <span className="cb-live-dots">
              <span className="dot green" /><span className="dot green" /><span className="dot green" />
            </span>
          </div>
          <div className={`cb-timer ${timeLeft < 120 ? 'danger' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Witness row */}
        <div className="cb-witness-row">
          {WITNESSES.map((w) => {
            const count = statements.filter((s) => s.witness_id === w.id).length
            return (
              <div
                key={w.id}
                className={`cb-witness ${count > 0 ? 'interviewed' : ''}`}
                onClick={() => handleInterrogate(w.id)}
              >
                <div className="cb-witness-circle" style={{ borderColor: w.color }}>
                  <span className="cb-witness-initials" style={{ background: w.color }}>{w.initials}</span>
                </div>
                <div className="cb-witness-name">{w.name.split(' ').slice(-1)[0] === 'Krishnan' ? 'Dr. Meena\nKrishnan' : w.name}</div>
                <div className="cb-witness-status">
                  {count > 0 ? <span className="status-done">Interviewed</span> : <span className="status-pending">Not yet interviewed</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Contradiction alerts */}
        {contradictions.length > 0 && (
          <div className="cb-section">
            <div className="cb-section-title">
              Contradiction alerts <span className="cb-count">{contradictions.length}</span>
            </div>
            {contradictions.map((c, i) => (
              <ContradictionAlert key={i} contradiction={c} />
            ))}
          </div>
        )}

        {/* Evidence collected */}
        <div className="cb-section">
          <div className="cb-section-title">
            Evidence collected <span className="cb-count">{statements.length}</span>
          </div>
          {statements.length === 0 ? (
            <div className="cb-empty">No evidence collected yet. Begin interrogating witnesses.</div>
          ) : (
            statements.map((s, i) => {
              const time = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={i} className="cb-evidence-card">
                  <div className="cb-ev-header">
                    <span className="cb-ev-dot" style={{ background: WITNESSES.find(w => w.id === s.witness_id)?.color || '#888' }} />
                    <span className="cb-ev-witness">{WITNESS_NAMES[s.witness_id] || s.witness_id}</span>
                    <span className="cb-ev-sep">·</span>
                    <span className="cb-ev-interviewer">{playerName}'s interview</span>
                  </div>
                  <div className="cb-ev-text">"{s.text}"</div>
                  <div className="cb-ev-time">{time}</div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="cb-sidebar">
        <div className="cb-section">
          <div className="cb-section-title">Team</div>
          <div className="cb-team-list">
            {players.length > 0 ? players.map((p, i) => (
              <div key={i} className="cb-team-member">
                <span className="cb-team-avatar" style={{ background: ['#e53935', '#43a047', '#42a5f5'][i % 3] }}>
                  {p.name?.slice(0, 2).toUpperCase() || '??'}
                </span>
                <div>
                  <div className="cb-team-name">{p.name}{i === 0 ? ' (you)' : ''}</div>
                  <div className="cb-team-status">Idle</div>
                </div>
              </div>
            )) : (
              <div className="cb-team-member">
                <span className="cb-team-avatar" style={{ background: '#e53935' }}>
                  {playerName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="cb-team-name">{playerName} (you)</div>
                  <div className="cb-team-status">Idle</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="cb-section">
          <div className="cb-section-title">Event log</div>
          <div className="cb-event-log">
            {eventLog.map((e, i) => (
              <div key={i} className="cb-event">
                <span className="cb-event-time">{fmtLogTime(e.time)}</span>
                <div>
                  <div className="cb-event-actor">{e.actor}</div>
                  <div className="cb-event-text">{e.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-accusation" onClick={() => setShowVerdict(true)}>
          Submit accusation
        </button>
      </div>

      {timeUp && !showVerdict && (
        <div className="modal-overlay">
          <div className="modal timesup-modal">
            <div className="timesup-icon">⏰</div>
            <h3>Time's up, detective!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: '12px 0 20px' }}>
              20 minutes have passed. The prime suspect is about to walk free.
              Make your final accusation now — who killed Dr. Shalini Rao?
            </p>
            <div className="timesup-stats">
              <div className="timesup-stat">
                <span className="timesup-stat-num">{statements.length}</span>
                <span className="timesup-stat-label">Evidence</span>
              </div>
              <div className="timesup-stat">
                <span className="timesup-stat-num">{contradictions.length}</span>
                <span className="timesup-stat-label">Contradictions</span>
              </div>
              <div className="timesup-stat">
                <span className="timesup-stat-num">{WITNESSES.filter(w => statements.some(s => s.witness_id === w.id)).length}/3</span>
                <span className="timesup-stat-label">Interviewed</span>
              </div>
            </div>
            <button className="btn btn-danger" style={{ width: '100%', padding: 14, fontSize: 15 }} onClick={() => { setTimeUp(false); setShowVerdict(true); }}>
              ⚖️ Make final accusation
            </button>
          </div>
        </div>
      )}

      {showVerdict && (
        <VerdictModal
          sessionId={sessionId}
          witnesses={SUSPECTS}
          onClose={() => setShowVerdict(false)}
        />
      )}
    </div>
  )
}
