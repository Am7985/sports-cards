# server/routers/media.py
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
from typing import Optional

import os
import hashlib

from PIL import Image, ImageOps  # EXIF-aware rotate

from ..deps import get_db
from ..models import Media, Card, Ownership

router = APIRouter(prefix="/v1/media", tags=["media"])

# ---------- config ----------
MEDIA_DIR = "media"
THUMB_SUBDIR = "thumbs"              # media/thumbs/
MAX_SIZE = 15 * 1024 * 1024          # 15 MB
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_KINDS = {"front", "back"}    # ✨ two-sided support

now = lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z"

# ---------- helpers ----------
def _public_url(rel: Optional[str]) -> Optional[str]:
    return f"/media/{rel}" if rel else None

def _ensure_dirs():
    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(os.path.join(MEDIA_DIR, THUMB_SUBDIR), exist_ok=True)

def _make_thumbnail(abs_path: str, media_uuid: str, max_side: int = 320) -> Optional[str]:
    """
    Create JPEG thumbnail from abs_path -> media/thumbs/<uuid>.jpg
    Returns relative path 'thumbs/<uuid>.jpg' or None on failure.
    """
    try:
        with Image.open(abs_path) as im:
            # normalize orientation (EXIF)
            im = ImageOps.exif_transpose(im)
            im = im.convert("RGB")
            im.thumbnail((max_side, max_side))
            rel = f"{THUMB_SUBDIR}/{media_uuid}.jpg"
            out_path = os.path.join(MEDIA_DIR, rel)
            im.save(out_path, "JPEG", quality=85, optimize=True)
            return rel
    except Exception:
        return None

# ---------- routes ----------

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    card_uuid: Optional[str] = Form(None),
    ownership_uuid: Optional[str] = Form(None),
    kind: Optional[str] = Form(None),  # 'front' | 'back' (optional)
    db: Session = Depends(get_db),
):
    if not card_uuid and not ownership_uuid:
        raise HTTPException(400, "Provide card_uuid or ownership_uuid")
    if card_uuid and not db.query(Card).filter_by(card_uuid=card_uuid).first():
        raise HTTPException(400, "card_uuid not found")
    if ownership_uuid and not db.query(Ownership).filter_by(ownership_uuid=ownership_uuid).first():
        raise HTTPException(400, "ownership_uuid not found")

    # Validate kind if provided
    kind_norm: Optional[str] = None
    if kind:
        k = kind.strip().lower()
        if k not in ALLOWED_KINDS:
            raise HTTPException(400, f"kind must be one of {sorted(ALLOWED_KINDS)}")
        kind_norm = k

    _ensure_dirs()

    # Basic file checks
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported file type: {ext} (allowed: {', '.join(sorted(ALLOWED_EXT))})")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(413, f"File too large (> {MAX_SIZE // 1024 // 1024} MB)")

    media_uuid = f"m_{uuid4()}"
    rel = f"{media_uuid}{ext}"
    abs_path = os.path.join(MEDIA_DIR, rel)

    # Write original
    with open(abs_path, "wb") as f:
        f.write(data)

    # Normalize / auto-rotate; also get dimensions
    try:
        with Image.open(abs_path) as im:
            im = ImageOps.exif_transpose(im)
            im.save(abs_path, quality=90, optimize=True)
            w, h = im.size
    except Exception:
        w, h = (0, 0)

    # SHA for dedupe/integrity
    sha = hashlib.sha256(data).hexdigest()

    # If a kind is specified, optionally "replace" older media of the same kind for this target
    if kind_norm:
        if card_uuid:
            priors = (
                db.query(Media)
                .filter(
                    Media.card_uuid == card_uuid,
                    Media.kind == kind_norm,
                    Media.deleted_at.is_(None),
                )
                .all()
            )
            for p in priors:
                p.deleted_at = now()
        elif ownership_uuid:
            priors = (
                db.query(Media)
                .filter(
                    Media.ownership_uuid == ownership_uuid,
                    Media.kind == kind_norm,
                    Media.deleted_at.is_(None),
                )
                .all()
            )
            for p in priors:
                p.deleted_at = now()

    # Create DB row
    m = Media(
        media_uuid=media_uuid,
        tenant_id="local",
        schema_version="v1",
        created_at=now(),
        updated_at=now(),
        path=rel,
        sha256=sha,
        kind=kind_norm,
        card_uuid=card_uuid,
        ownership_uuid=ownership_uuid,
        width=str(w),
        height=str(h),
        filesize_bytes=str(len(data)),
    )

    # Optional: generate a thumbnail and store if the model supports it
    thumb_rel = _make_thumbnail(abs_path, media_uuid)
    if thumb_rel and hasattr(m, "thumbnail_path"):
        setattr(m, "thumbnail_path", thumb_rel)

    db.add(m)
    db.commit()
    db.refresh(m)

    return {
        "ok": True,
        "media_uuid": m.media_uuid,
        "kind": m.kind,
        "url": _public_url(m.path),
        "thumb_url": _public_url(getattr(m, "thumbnail_path", None) or m.path),
    }


@router.get("/latest")
def latest_for_card(
    card_uuid: str = Query(..., description="Card UUID"),
    kind: Optional[str] = Query(None, description="Optional filter (front|back)"),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Media)
        .filter(Media.card_uuid == card_uuid, Media.deleted_at.is_(None))
        .order_by(Media.created_at.desc())
    )
    if kind:
        q = q.filter(Media.kind == kind.strip().lower())

    m = q.first()
    if not m:
        return {"url": None, "thumb_url": None}

    thumb_rel = getattr(m, "thumbnail_path", None)
    return {
        "media_uuid": m.media_uuid,
        "kind": getattr(m, "kind", None),
        "url": _public_url(m.path),
        "thumb_url": _public_url(thumb_rel or m.path),
        "created_at": m.created_at,
    }

@router.get("/pair")
def pair_for_card(
    card_uuid: str = Query(..., description="Card UUID"),
    db: Session = Depends(get_db),
):
    def latest_by(kind: str):
        q = (
            db.query(Media)
            .filter(
                Media.card_uuid == card_uuid,
                Media.deleted_at.is_(None),
                Media.kind == kind,
            )
            .order_by(Media.created_at.desc())
        )
        m = q.first()
        if not m:
            return None
        thumb_rel = getattr(m, "thumbnail_path", None)
        return {
            "media_uuid": m.media_uuid,
            "url": _public_url(m.path),
            "thumb_url": _public_url(thumb_rel or m.path),
            "created_at": m.created_at,
        }

    return {
        "front": latest_by("front"),
        "back": latest_by("back"),
    }

@router.get("", response_model=list[dict])  # simple shape for now
def list_media(
    card_uuid: Optional[str] = None,
    ownership_uuid: Optional[str] = None,
    kind: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Media).filter(Media.deleted_at.is_(None))
    if card_uuid:
        q = q.filter(Media.card_uuid == card_uuid)
    if ownership_uuid:
        q = q.filter(Media.ownership_uuid == ownership_uuid)
    if kind:
        q = q.filter(Media.kind == kind.strip().lower())

    rows = q.order_by(Media.created_at.desc()).all()
    out = []
    for m in rows:
        thumb_rel = getattr(m, "thumbnail_path", None)
        out.append(
            {
                "media_uuid": m.media_uuid,
                "card_uuid": m.card_uuid,
                "ownership_uuid": m.ownership_uuid,
                "kind": getattr(m, "kind", None),
                "url": _public_url(m.path),
                "thumb_url": _public_url(thumb_rel or m.path),
                "created_at": m.created_at,
            }
        )
    return out
