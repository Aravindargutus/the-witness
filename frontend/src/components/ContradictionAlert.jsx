export default function ContradictionAlert({ contradiction }) {
  return (
    <div className="contradiction-card">
      <div className="contradiction-label">
        <span className="contradiction-dot" />
        {contradiction.topic || 'Conflict'} — {contradiction.confidence || 'high'} confidence
      </div>
      <div className="contradiction-text">
        {contradiction.summary}
      </div>
    </div>
  )
}
