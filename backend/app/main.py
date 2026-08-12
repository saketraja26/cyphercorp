import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text
from sqlmodel import SQLModel

from app.database.database import engine
from app.models.user import User
from app.models.dataset import Dataset
from app.models.experiment import Experiment
from app.models.ml_model import MLModel
from app.models.query_history import QueryHistory

from app.auth.router import router as auth_router
from app.datasets.router import router as datasets_router
from app.sql.router import router as sql_router
from app.ml.router import router as ml_router
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically initialize tables on new cloud database (e.g. Neon / Render Postgres)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Database initialization warning: {e}")
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
]
if cors_env:
    allowed_origins.extend([o.strip() for o in cors_env.split(",") if o.strip()])

# In production, allow all origins if not explicitly constrained
origins_to_allow = ["*"] if not cors_env else allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_to_allow,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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