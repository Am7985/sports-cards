# server/settings.py
import os
from types import SimpleNamespace

try:
    # load .env from project root so os.getenv picks it up
    from dotenv import load_dotenv  # pip install python-dotenv
    load_dotenv()
except Exception:
    pass  # ok if not installed; we'll use sane defaults below

def _get(name, default): 
    return os.getenv(name, default)

def _csv(name, default_csv):
    raw = _get(name, default_csv)
    return [x.strip() for x in raw.split(",") if x.strip()]

settings = SimpleNamespace(
    app_env=_get("APP_ENV", "local"),
    db_path=_get("DB_PATH", "./data/catalog.sqlite"),
    bind_host=_get("BIND_HOST", "127.0.0.1"),
    bind_port=int(_get("BIND_PORT", "8787")),
    # IMPORTANT: default includes both localhost styles + tauri
    cors_origins=_csv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,tauri://localhost",
    ),
)
