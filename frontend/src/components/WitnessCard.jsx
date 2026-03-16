export default function WitnessCard({ witness, statementCount, onClick }) {
  const statusClass = statementCount > 0 ? 'status-interviewed' : 'status-available'
  return (
    <div className="witness-card" onClick={onClick}>
      <div className="witness-avatar">{witness.emoji}</div>
      <div className="witness-name">{witness.name}</div>
      <div className="witness-role">{witness.role}</div>
      <div className={`witness-status ${statusClass}`}>
        {statementCount > 0 ? `${statementCount} statements` : 'Not interviewed'}
      </div>
    </div>
  )
}
