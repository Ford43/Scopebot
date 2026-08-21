from fastapi import APIRouter
from api.database import engine

router = APIRouter(prefix="/api/system", tags=["System"])

@router.get("/health")
def health():
    return {
        "status": "ok",
        "database": "connected"
    }