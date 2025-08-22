from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
import os, hashlib
from PIL import Image
from typing import Optional   # <-- added

from ..deps import get_db
from ..models import Media, Card, Ownership

router = APIRouter(prefix="/v1/media", tags=["media"])
now = lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z"

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    card_uuid: str | None = Form(None),
    ownership_uuid: str | None = Form(None),
    kind: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not card_uuid and not ownership_uuid:
        raise HTTPException(400, "Provide card_uuid or ownership_uuid")
    if card_uuid and not db.query(Card).filter_by(card_uuid=card_uuid).first():
        raise HTTPException(400, "card_uuid not found")
    if ownership_uuid and not db.query(Ownership).filter_by(ownership_uuid=ownership_uuid).first():
        raise HTTPException(400, "ownership_uuid not found")

    os.makedirs("media", exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    media_uuid = f"m_{uuid4()}"
    rel = f"{media_uuid}{ext}"
    abs_path = os.path.join("media", rel)

    data = await file.read()
    with open(abs_path, "wb") as f: f.write(data)

    sha = hashlib.sha256(data).hexdigest()
    try:
        with Image.open(abs_path) as im:
            w, h = im.size
    except Exception:
        w, h = 0, 0

    m = Media(
        media_uuid=media_uuid, tenant_id="local", schema_version="v1",
        created_at=now(), updated_at=now(),
        path=rel, sha256=sha, kind=kind,
        card_uuid=card_uuid, ownership_uuid=ownership_uuid,
        width=str(w), height=str(h), filesize_bytes=str(len(data)),
    )
    db.add(m); db.commit(); db.refresh(m)
    return {"ok": True, "media_uuid": media_uuid, "url": f"/media/{rel}"}

@router.get("/latest")
def latest_for_card(
    card_uuid: str = Query(..., description="Card UUID"),
    kind: Optional[str] = Query(None, description="Optional filter (e.g., 'front')"),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Media)
        .filter(Media.card_uuid == card_uuid, Media.deleted_at.is_(None))
        .order_by(Media.created_at.desc())
    )
    if kind:
        q = q.filter(Media.kind == kind)

    m = q.first()
    if not m:
        return {"url": None, "thumb_url": None}

    # If your table has m.thumbnail_path, use it; otherwise fall back to full image
    base = "/media/"
    thumb = getattr(m, "thumbnail_path", None)
    return {
        "media_uuid": m.media_uuid,
        "url": f"{base}{m.path}",
        "thumb_url": f"{base}{(thumb or m.path)}",
    }

@router.get("", response_model=list[dict])  # keep it simple; or define a Pydantic model later
def list_media(
    card_uuid: Optional[str] = None,
    ownership_uuid: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Media).filter(Media.deleted_at.is_(None))
    if card_uuid:
        q = q.filter(Media.card_uuid == card_uuid)
    if ownership_uuid:
        q = q.filter(Media.ownership_uuid == ownership_uuid)
    rows = q.order_by(Media.created_at.desc()).all()

    base = "/media/"
    out = []
    for m in rows:
        thumb = getattr(m, "thumbnail_path", None)
        out.append(
            {
                "media_uuid": m.media_uuid,
                "card_uuid": m.card_uuid,
                "ownership_uuid": m.ownership_uuid,
                "kind": getattr(m, "kind", None),
                "url": f"{base}{m.path}",
                "thumb_url": f"{base}{(thumb or m.path)}",
                "created_at": m.created_at,
            }
        )
    return out