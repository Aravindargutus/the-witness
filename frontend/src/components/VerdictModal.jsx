import { useState } from 'react'
import { api } from '../lib/api'

export default function VerdictModal({ sessionId, witnesses, onClose }) {
  const [accused, setAccused] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!accused || !reasoning.trim()) return
    const playerId = localStorage.getItem('playerId')
    if (!playerId) {
      console.error('No player ID found — cannot submit verdict')
      return
    }
    setSubmitting(true)
    try {
      const verdict = await api.submitVerdict(sessionId, {
        player_id: playerId,
        accused_witness: accused,
        reasoning,
      })
      setResult(verdict)
    } catch (e) {
      console.error(e)
    }
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!result ? (
          <>
            <h3>Make your accusation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Who killed Dr. Shalini Rao?
            </p>
            <div className="suspect-options">
              {witnesses.map((w) => (
                <button
                  key={w.id}
                  className={`suspect-btn ${accused === w.id ? 'selected' : ''}`}
                  onClick={() => setAccused(w.id)}
                >
                  {w.emoji} {w.name.split(' ')[0]}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Explain your reasoning — what evidence led you here?"
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', flex: 1 }} onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Accuse'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{result.correct ? '🎯 Correct!' : '❌ Wrong suspect'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
              {result.reveal}
            </p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}
