import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVoice } from '../hooks/useVoice'

const WITNESS_INFO = {
  meena: {
    name: 'Dr. Meena Krishnan',
    initials: 'MK',
    color: '#e53935',
    subtitle: 'Research colleague · Floor 3',
    tags: ['Composed', 'Evasive'],
    motiveTag: 'Motive',
  },
  arjun: {
    name: 'Arjun Patel',
    initials: 'AP',
    color: '#43a047',
    subtitle: 'Lab assistant · Floor 2',
    tags: ['Nervous', 'Talkative'],
    motiveTag: 'Hiding something',
  },
  rajan: {
    name: 'Rajan Kumar',
    initials: 'RK',
    color: '#ab47bc',
    subtitle: 'Night guard · Main entrance',
    tags: ['Gruff', 'Evasive'],
    motiveTag: 'Suspicious',
  },
}

export default function Interrogation() {
  const { sessionId, witnessId } = useParams()
  const navigate = useNavigate()
  const witness = WITNESS_INFO[witnessId]
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [notes, setNotes] = useState([])
  const [stressLevel, setStressLevel] = useState(15)
  const chatRef = useRef(null)
  const pendingRef = useRef('')
  const turnCountRef = useRef(0)

  const { isRecording, toggleRecording, sendText, isConnected } = useVoice({
    sessionId,
    witnessId,
    onWitnessResponse: (text, kind) => {
      if (kind === 'partial') {
        pendingRef.current += text
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'witness' && last.pending) {
            return [...prev.slice(0, -1), { role: 'witness', text: pendingRef.current, pending: true, time: last.time }]
          }
          return [...prev, { role: 'witness', text: pendingRef.current, pending: true, time: new Date() }]
        })
      } else {
        const finalText = text && text !== '[audio response]' ? text : pendingRef.current || text
        pendingRef.current = ''
        turnCountRef.current += 1
        // Simulate stress based on turns
        setStressLevel((prev) => Math.min(95, prev + Math.floor(Math.random() * 12) + 5))
        // Auto-generate a note from the response
        if (finalText && finalText.length > 20) {
          const snippet = finalText.length > 60 ? finalText.slice(0, 57) + '...' : finalText
          setNotes((prev) => [...prev.slice(-4), snippet])
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'witness' && last.pending) {
            return [...prev.slice(0, -1), { role: 'witness', text: finalText, time: last.time }]
          }
          return [...prev, { role: 'witness', text: finalText, time: new Date() }]
        })
      }
    },
    onUserTranscript: (text) => {
      setMessages((prev) => [...prev, { role: 'user', text, time: new Date() }])
    },
  })

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const handleSendText = () => {
    if (!textInput.trim()) return
    setMessages((prev) => [...prev, { role: 'user', text: textInput, time: new Date() }])
    sendText(textInput)
    setTextInput('')
  }

  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  const getStressColor = () => {
    if (stressLevel < 30) return 'var(--accent-green)'
    if (stressLevel < 60) return 'var(--accent-amber)'
    return 'var(--accent-red)'
  }

  return (
    <div className="ig">
      {/* Left sidebar — witness profile */}
      <div className="ig-sidebar">
        <button className="btn btn-ghost ig-back" onClick={() => navigate(`/case/${sessionId}`)}>
          ← Case Board
        </button>

        <div className="ig-profile">
          <div className="ig-avatar" style={{ borderColor: witness?.color }}>
            <span className="ig-initials" style={{ background: witness?.color }}>{witness?.initials}</span>
          </div>
          <div className="ig-name">{witness?.name}</div>
          <div className="ig-subtitle">{witness?.subtitle}</div>
          <div className="ig-tags">
            {witness?.tags.map((t) => (
              <span key={t} className="ig-tag">{t}</span>
            ))}
            <span className="ig-tag motive">{witness?.motiveTag}</span>
          </div>
        </div>

        <div className="ig-stress">
          <div className="ig-stress-header">
            <span>Stress level</span>
            <span style={{ color: getStressColor() }}>{stressLevel}%</span>
          </div>
          <div className="ig-stress-bar">
            <div className="ig-stress-fill" style={{ width: `${stressLevel}%`, background: getStressColor() }} />
          </div>
        </div>

        <div className="ig-notes">
          <div className="ig-notes-title">Your notes</div>
          {notes.length === 0 ? (
            <div className="ig-notes-empty">Notes will appear as you interrogate...</div>
          ) : (
            notes.map((n, i) => (
              <div key={i} className="ig-note-item">
                <span className="ig-note-dash">—</span> {n}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right main — chat */}
      <div className="ig-main">
        <div className="ig-header">
          Interrogation — {witness?.name}
        </div>

        <div className="ig-chat" ref={chatRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">🎙️</div>
              <p>Click the microphone or type below to begin</p>
              <p className="chat-empty-sub">Ask questions to uncover the truth</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`ig-msg ${msg.role}`}>
              <div className="ig-msg-sender">
                {msg.role === 'user' ? 'You' : witness?.name}
                {msg.role === 'witness' && stressLevel > 55 && i === messages.length - 1 && (
                  <span className="ig-mood"> · stress rising</span>
                )}
              </div>
              <div className="ig-msg-bubble">{msg.role === 'user' ? `"${msg.text}"` : `"${msg.text}"`}</div>
              {msg.time && <div className="ig-msg-time">{fmtTime(msg.time)}</div>}
            </div>
          ))}
        </div>

        {/* Voice bar */}
        <div className="ig-voice-bar">
          <div className="ig-voice-row">
            <button
              className={`ig-mic ${isRecording ? 'recording' : ''}`}
              onClick={toggleRecording}
            >
              🎙️
            </button>
            {isRecording ? (
              <div className="ig-waveform">
                <div className="ig-wave-bars">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="ig-wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <span className="ig-listening">Listening — speak your question</span>
              </div>
            ) : (
              <div className="ig-text-input-row">
                <input
                  type="text"
                  placeholder={isConnected ? 'Type a question...' : 'Connecting...'}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  disabled={!isConnected}
                  className="ig-text-input"
                />
                <button
                  className="btn btn-send"
                  onClick={handleSendText}
                  disabled={!isConnected || !textInput.trim()}
                >
                  Send
                </button>
              </div>
            )}
            <div className="ig-gemini-status">
              <span className="ig-gemini-label">Gemini Live</span>
              <span className={`ig-gemini-dot ${isConnected ? 'connected' : ''}`}>
                {isConnected ? 'connected' : 'connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
