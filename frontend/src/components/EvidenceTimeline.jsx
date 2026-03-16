import ClueCard from './ClueCard'

export default function EvidenceTimeline({ statements }) {
  if (statements.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
        No evidence collected yet. Begin interrogating witnesses.
      </div>
    )
  }

  return (
    <div>
      {statements.map((s, i) => (
        <ClueCard key={i} statement={s} />
      ))}
    </div>
  )
}
