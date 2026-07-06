"""
FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import game

app = FastAPI(
    title="82-0 NBA Lineup Builder",
    description="Build the greatest 10-man NBA lineup of all time.",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Allows the frontend (running on localhost:3000 in dev) to talk to the API
# (running on localhost:8000). In production this would be locked down to
# your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(game.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}