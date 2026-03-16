import os
from contextlib import asynccontextmanager

from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from project root (one level up from backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from routers import session, statements, case, verdict, interrogate
from middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(title="The Witness", version="0.1.0", lifespan=lifespan)

# Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

# CORS — driven entirely from env; fallback to localhost for local dev only
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5178")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)

app.include_router(session.router, prefix="/session", tags=["session"])
app.include_router(statements.router, prefix="/statement", tags=["statements"])
app.include_router(case.router, prefix="/case", tags=["case"])
app.include_router(verdict.router, prefix="/verdict", tags=["verdict"])
app.include_router(interrogate.router, prefix="/ws", tags=["interrogation"])


@app.get("/health")
async def health():
    return {"status": "ok"}
