# server/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .settings import settings

app = FastAPI(title="Sports Cards API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("media", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

from .routers import cards
from .routers import export as export_router
from .routers import import_csv
from .routers import ownership
from .routers import media as media_router   # <-- import directly

app.include_router(cards.router)
app.include_router(export_router.router)
app.include_router(import_csv.router)
app.include_router(ownership.router)
app.include_router(media_router.router)      # <-- include directly

@app.get("/health")
def health():
    return {"ok": True, "env": settings.app_env}
