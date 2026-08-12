from fastapi import FastAPI
from sqlalchemy import text
from app.auth.router import router as auth_router
from app.database.database import engine
from app.models.dataset import Dataset
from app.datasets.router import router as datasets_router
from app.sql.router import router as sql_router
from app.ml.router import router as ml_router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="CypherCorp API",
    description="AI-powered data intelligence platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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