from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from ..deps import get_db
from ..models import Ownership, Card
from ..schemas import OwnershipCreate, OwnershipOut

router = APIRouter(prefix="/v1/ownership", tags=["ownership"])
now = lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z"

@router.get("", response_model=List[OwnershipOut])
def list_ownership(card_uuid: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Ownership).filter(Ownership.deleted_at.is_(None))
    if card_uuid:
        q = q.filter(Ownership.card_uuid == card_uuid)
    return q.order_by(Ownership.updated_at.desc()).all()

@router.post("", response_model=OwnershipOut)
def create_ownership(payload: OwnershipCreate, db: Session = Depends(get_db)):
    if not db.query(Card).filter(Card.card_uuid == payload.card_uuid).first():
        raise HTTPException(400, "card_uuid does not exist")
    o = Ownership(
        ownership_uuid=f"o_{uuid4()}",
        tenant_id="local", schema_version="v1",
        created_at=now(), updated_at=now(),
        **payload.model_dump(),
    )
    db.add(o); db.commit(); db.refresh(o)
    return o

@router.delete("/{ownership_uuid}")
def delete_ownership(ownership_uuid: str, db: Session = Depends(get_db)):
    o = db.query(Ownership).filter(Ownership.ownership_uuid == ownership_uuid, Ownership.deleted_at.is_(None)).first()
    if not o:
        raise HTTPException(404, "Ownership not found")
    o.deleted_at = now()
    db.add(o); db.commit()
    return {"ok": True}
