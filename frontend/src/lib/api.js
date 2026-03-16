const BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  createSession: (hostName) =>
    request('/session/start', {
      method: 'POST',
      body: JSON.stringify({ host_name: hostName }),
    }),

  getSession: (sessionId) =>
    request(`/session/${sessionId}`),

  joinSession: (sessionId, playerName) =>
    request(`/session/${sessionId}/join?player_name=${encodeURIComponent(playerName)}`, {
      method: 'POST',
    }),

  getCaseBoard: (sessionId) =>
    request(`/case/${sessionId}`),

  saveStatement: (sessionId, data) =>
    request(`/statement/?session_id=${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitVerdict: (sessionId, data) =>
    request(`/verdict/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
