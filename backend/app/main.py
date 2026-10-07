from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.routers import sessions,snapshots,me,execute,run_ws,github_export
from app.sync import server as sync_server
from app.sync import persistence

@asynccontextmanager
async def lifespan(app: FastAPI):
    # The WebSocket server must be running for rooms to work
    async with sync_server.websocket_server:
        yield
        # Shutting down: save every room that still has unsaved changes
        await persistence.flush_all()

app = FastAPI(title="Realtime Code Collaborator API", lifespan=lifespan)

# CORS applies to HTTP calls. WebSockets are checked by the Origin test in sync/server.py.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(snapshots.router)
app.include_router(me.router)
app.include_router(sync_server.router)
app.include_router(execute.router)
app.include_router(run_ws.router)
app.include_router(github_export.router)  

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("select version()"))
        return {"database": "connected", "version": result.scalar()}
    except Exception as exc:
        print(f"Database check failed: {exc!r}")
        raise HTTPException(status_code=503, detail="Database connection failed")