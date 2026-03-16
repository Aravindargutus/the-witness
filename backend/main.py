import os
from contextlib import asynccontextmanager

from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from project root (one level up from backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from routers import session, statements, case, verdict, interrogate


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(title="The Witness", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:5178"),
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5179",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router, prefix="/session", tags=["session"])
app.include_router(statements.router, prefix="/statement", tags=["statements"])
app.include_router(case.router, prefix="/case", tags=["case"])
app.include_router(verdict.router, prefix="/verdict", tags=["verdict"])
app.include_router(interrogate.router, prefix="/ws", tags=["interrogation"])


@app.get("/health")
async def health():
    return {"status": "ok"}
