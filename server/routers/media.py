from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
import os, hashlib
from PIL import Image

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
