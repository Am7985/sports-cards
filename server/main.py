# server/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .settings import settings

from .routers import cards  # <— add

app = FastAPI(title="Sports Cards API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # precise list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cards.router)  # <— add

@app.get("/health")
def health():
    return {"ok": True, "env": settings.app_env}
