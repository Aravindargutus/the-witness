import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

/**
 * Polls the backend /case/{sessionId} endpoint for statements,
 * contradictions, and players. Replaces the Firebase real-time
 * listener since Firestore is disabled (in-memory store on backend).
 */
export function useFirestore(sessionId) {
  const [statements, setStatements] = useState([])
  const [contradictions, setContradictions] = useState([])
  const [players, setPlayers] = useState([])
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!sessionId) return

    const fetchData = async () => {
      try {
        const data = await api.getCaseBoard(sessionId)
        setStatements(data.statements || [])
        setContradictions(data.contradictions || [])
        setPlayers(data.players || [])
      } catch (err) {
        // Session might not exist yet, that's ok
        console.debug('Case board fetch:', err.message)
      }
    }

    // Fetch immediately, then poll every 3 seconds
    fetchData()
    intervalRef.current = setInterval(fetchData, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sessionId])

  return { statements, contradictions, players }
}
