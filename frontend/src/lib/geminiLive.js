/**
 * Gemini Live API client for real-time voice interaction.
 *
 * Connects to the backend WebSocket endpoint which proxies
 * to Gemini Live API with the witness agent context.
 */

const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`

export async function connectGeminiLive({ sessionId, witnessId, onResponse, onAudio, onConnected, onDisconnected, onError, onUserTranscript }) {
  return new Promise((resolve, reject) => {
    const url = `${WS_BASE}/interrogate/${sessionId}/${witnessId}`
    console.log('[GeminiLive] Connecting to:', url)
    const ws = new WebSocket(url)

    const connection = {
      sendAudio: (pcmData) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(pcmData)
        }
      },
      sendText: (text) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'text', text }))
        }
      },
      endTurn: () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end_turn' }))
        }
      },
      close: () => ws.close(),
    }

    ws.onopen = () => {
      console.log('[GeminiLive] WebSocket opened')
    }

    ws.onmessage = (event) => {
      // Binary data = audio from Gemini
      if (event.data instanceof Blob) {
        onAudio?.(event.data)
        return
      }

      // Text data = JSON messages
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') {
          console.log('[GeminiLive] Connected to witness:', data.witness)
          onConnected?.()
          resolve(connection)
        } else if (data.type === 'transcript') {
          console.log('[GeminiLive] Transcript:', data.text)
          onResponse?.(data.text, 'partial')
        } else if (data.type === 'turn_complete') {
          console.log('[GeminiLive] Turn complete:', data.text)
          onResponse?.(data.text, 'complete')
        } else if (data.type === 'user_transcript') {
          console.log('[GeminiLive] User transcript:', data.text)
          onUserTranscript?.(data.text)
        } else if (data.type === 'voice_ready') {
          console.log('[GeminiLive] Voice session ready')
        } else if (data.type === 'error') {
          console.error('[GeminiLive] Error:', data.text)
          onError?.(data.text)
        }
      } catch {
        console.warn('[GeminiLive] Unparseable message:', event.data)
      }
    }

    ws.onclose = () => {
      console.log('[GeminiLive] Disconnected')
      onDisconnected?.()
    }

    ws.onerror = (err) => {
      console.error('[GeminiLive] WebSocket error:', err)
      onError?.(err)
      reject(err)
    }

    // Timeout if no "connected" message within 15s
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'))
      }
    }, 15000)
  })
}
