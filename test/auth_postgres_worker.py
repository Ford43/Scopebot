"""Minimal HTTP host for PostgreSQL integration tests; production auth code unchanged."""
import os

from fastapi import FastAPI
from api.routers.auth import router

app = FastAPI()
app.include_router(router)


@app.get('/worker')
def worker():
    return {'pid': os.getpid()}
