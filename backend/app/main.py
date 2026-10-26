"""DriveEdge FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.db import Base, engine
from app.api import admin, ai, auth, cars, customer, dealer, dealers, enquiries

logging.basicConfig(level=logging.INFO)

limiter = Limiter(key_func=get_remote_address, default_limits=["240/minute"])

app = FastAPI(
    title="DriveEdge API",
    version="0.1.0",
    description="AI-powered automotive marketplace for India.",
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests, please slow down."})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Create tables automatically for SQLite/dev. For Postgres, prefer Alembic migrations.
    if settings.database_url.startswith("sqlite"):
        import app.models  # noqa: F401  (register models)

        Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    from app.ai.claude_service import get_claude

    return {"status": "ok", "env": settings.app_env, "ai": get_claude().status}


app.include_router(auth.router)
app.include_router(cars.router)
app.include_router(dealers.router)
app.include_router(enquiries.router)
app.include_router(customer.router)
app.include_router(dealer.router)
app.include_router(admin.router)
app.include_router(ai.router)
