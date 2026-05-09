from fastapi import FastAPI
from app.api import bots, users

app = FastAPI(title="Scopebot API")

# เชื่อมต่อ Router ของ bots
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(bots.router, prefix="/api/bots", tags=["Bots"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Scopebot API"}