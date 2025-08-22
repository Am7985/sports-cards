# server/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .settings import settings

# 1) create the app FIRST
app = FastAPI(title="Sports Cards API", version="0.1.0")

# 2) CORS using your settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3) make sure the media directory exists, then mount it
os.makedirs("media", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

# 4) include routers AFTER app exists
from .routers import cards
from .routers import export as export_router
from .routers import import_csv
app.include_router(import_csv.router)

# optional ones if you've created them
try:
    from .routers import ownership
    from .routers import media as media_router
except Exception:
    ownership = None
    media_router = None

app.include_router(cards.router)
app.include_router(export_router.router)
if ownership:
    app.include_router(ownership.router)
if media_router:
    app.include_router(media_router.router)

# 5) health
@app.get("/health")
def health():
    return {"ok": True, "env": settings.app_env}
