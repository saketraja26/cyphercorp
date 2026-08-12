import os
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database.database import Base, engine
# Import all models to register them on Base.metadata
from app.models.user import User
from app.models.dataset import Dataset

from app.auth.router import router as auth_router
from app.datasets.router import router as datasets_router
from app.sql.router import router as sql_router
from app.ml.router import router as ml_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically initialize tables on new database (PostgreSQL/SQLite)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Auto-migrate: ensure csv_data column exists on datasets table
            try:
                await conn.execute(text("ALTER TABLE datasets ADD COLUMN IF NOT EXISTS csv_data TEXT;"))
            except Exception:
                pass
        print("Database tables initialized successfully via Base.metadata.")
    except Exception as e:
        print(f"Database initialization error: {e}")
        traceback.print_exc()
    yield


app = FastAPI(
    title="CypherCorp API",
    description="AI-powered data intelligence & AutoML platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS for local development, Vercel, and custom domains
cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://cyphercorp.vercel.app",
]
if cors_env:
    for o in cors_env.split(","):
        clean_origin = o.strip()
        if clean_origin and clean_origin not in allowed_origins:
            allowed_origins.append(clean_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )


app.include_router(auth_router)
app.include_router(datasets_router)
app.include_router(sql_router)
app.include_router(ml_router)


@app.get("/")
def root():
    return {
        "message": "Welcome to CypherCorp API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
        }