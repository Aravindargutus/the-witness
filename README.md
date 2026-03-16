# The Witness 🔍

A real-time AI murder mystery interrogation game powered by Google Gemini Live. Players interrogate three AI witnesses — each with distinct personalities, secrets, and lies — to uncover who killed Dr. Shalini Rao.

## The Case

**Victim:** Dr. Shalini Rao, found dead in Lab 3B of the BioNova Research Institute, Chennai — midnight.

**Your suspects:**

| Witness | Role | Personality |
|---------|------|-------------|
| 🧪 **Meena Krishnamurthy** | Senior Research Scientist | Controlled, precise, hiding something behind her professionalism |
| 😰 **Arjun Patel** | Junior Lab Assistant | Nervous, over-explains, slips between Tamil and English when rattled |
| 🔒 **Rajan Venkatesh** | Night Security Guard | Guarded, loyal to a fault, knows more than he's saying |

Interrogate each witness via **real-time voice** or text, collect contradictions, and make your accusation.

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) + Python 3.12
- [Google Gemini Live API](https://ai.google.dev/) — real-time voice conversations (`gemini-2.5-flash-native-audio-preview`)
- [Gemini Flash](https://ai.google.dev/) — text interrogation + audio transcription
- [Google Firestore](https://firebase.google.com/products/firestore) — session & statement storage (with in-memory fallback for local dev)
- WebSockets for live audio streaming

**Frontend**
- [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- [React Router v7](https://reactrouter.com/)
- Web Audio API — mic capture and PCM streaming

**AI Agents**
- [Google ADK](https://google.github.io/adk-docs/) — witness agent scaffolding
- Contradiction Engine — LLM-based cross-witness statement analysis

---

## Project Structure

```
the-witness/
├── backend/                  # FastAPI app
│   ├── main.py               # App entry point, CORS, routes
│   ├── routers/
│   │   ├── interrogate.py    # WebSocket: Gemini Live voice interrogation
│   │   ├── session.py        # Create/join sessions
│   │   ├── statements.py     # Fetch witness statements
│   │   ├── case.py           # Case metadata
│   │   └── verdict.py        # Submit accusation & reveal killer
│   ├── services/
│   │   ├── firestore.py      # DB client (Firestore or in-memory)
│   │   └── contradiction.py  # LLM contradiction detection
│   └── models/               # Pydantic models
├── frontend/                 # React app
│   └── src/
│       ├── pages/            # Lobby, CaseBoard, Interrogation
│       ├── components/       # WitnessCard, ContradictionAlert, VerdictModal, …
│       ├── hooks/            # useVoice, useFirestore
│       └── lib/              # api.js, geminiLive.js
└── agents/
    ├── witnesses/            # Arjun, Meena, Rajan agent logic
    └── prompts/              # Character system prompts
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- A Google API key with Gemini access ([get one](https://aistudio.google.com/app/apikey))
- *(Optional)* A Google Cloud project with Firestore for persistence

### 1. Clone & configure

```bash
git clone https://github.com/<your-username>/the-witness.git
cd the-witness
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional — leave blank to use the in-memory store
GOOGLE_CLOUD_PROJECT=
FIRESTORE_DATABASE=(default)

# Optional — for production CORS
FRONTEND_URL=http://localhost:5173
```

### 2. Start the backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` (or the next available port).

---

## How to Play

1. **Lobby** — Enter your name and create a session. Share the case code with other players.
2. **Case Board** — Review evidence, track contradictions, and choose a witness to interrogate.
3. **Interrogation** — Ask questions by voice or text. The witness responds in real-time audio. Contradictions between witnesses are automatically flagged.
4. **Verdict** — When ready, accuse a suspect and explain your reasoning. Find out if you cracked the case.

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/session/create` | Create a new session |
| `POST` | `/session/{id}/join` | Join an existing session |
| `GET` | `/statement/{session_id}` | Fetch all witness statements |
| `GET` | `/case/` | Get case metadata & evidence |
| `POST` | `/verdict/{session_id}` | Submit accusation |
| `WS` | `/ws/interrogate/{session_id}/{witness_id}` | Live voice interrogation |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | ✅ | Gemini API key |
| `GOOGLE_CLOUD_PROJECT` | ❌ | GCP project ID (Firestore) |
| `FIRESTORE_DATABASE` | ❌ | Firestore DB name (default: `(default)`) |
| `FRONTEND_URL` | ❌ | Frontend origin for CORS (production) |

---

## Deployment

The backend includes a `Dockerfile` and `cloudbuild.yaml` for Google Cloud Run.

```bash
# Build and run locally
docker build -t the-witness-backend ./backend
docker run -p 8080:8080 --env-file .env the-witness-backend
```

---

## License

MIT
