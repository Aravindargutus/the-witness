const WITNESS_NAMES = {
  meena: 'Dr. Meena Krishnan',
  arjun: 'Arjun Patel',
  rajan: 'Rajan Kumar',
}

export default function ClueCard({ statement }) {
  const time = new Date(statement.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="clue-card">
      <div className="clue-witness">{WITNESS_NAMES[statement.witness_id] || statement.witness_id}</div>
      <div className="clue-text">{statement.text}</div>
      <div className="clue-time">{time}</div>
    </div>
  )
}
