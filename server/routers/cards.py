# server/routers/cards.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from ..deps import get_db
from ..models import Card
from ..schemas import CardCreate, CardUpdate, CardOut

router = APIRouter(prefix="/v1/cards", tags=["cards"])

def now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def canon(year, brand, set_name, subset, card_no, parallel, variant) -> str:
    to_s = lambda v: ("" if v is None else str(v)).strip().lower()
    return "|".join([to_s(year), to_s(brand), to_s(set_name),
                     to_s(subset), to_s(card_no), to_s(parallel), to_s(variant)])

@router.get("", response_model=List[CardOut])
def list_cards(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="search player/brand/set"),
    limit: int = 100,
    offset: int = 0,
):
    query = db.query(Card).filter(Card.deleted_at.is_(None))
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            (Card.player.ilike(like)) |
            (Card.brand.ilike(like))  |
            (Card.set_name.ilike(like)) |
            (Card.card_no.ilike(like))
        )
    return query.order_by(Card.updated_at.desc()).offset(offset).limit(limit).all()

@router.get("/{card_uuid}", response_model=CardOut)
def get_card(card_uuid: str, db: Session = Depends(get_db)):
    c = db.query(Card).filter(Card.card_uuid == card_uuid, Card.deleted_at.is_(None)).first()
    if not c:
        raise HTTPException(404, "Card not found")
    return c

@router.post("", response_model=CardOut)
def create_card(payload: CardCreate, db: Session = Depends(get_db)):
    card = Card(
        card_uuid=f"c_{uuid4()}",
        tenant_id="local", schema_version="v1",
        created_at=now(), updated_at=now(),
        year=payload.year, brand=payload.brand, set_name=payload.set_name,
        subset=payload.subset, card_no=payload.card_no, player=payload.player,
        team=payload.team, sport=payload.sport, parallel=payload.parallel,
        variant=payload.variant, print_run=payload.print_run, notes=payload.notes,
    )
    card.canonical_key = canon(card.year, card.brand, card.set_name, card.subset,
                               card.card_no, card.parallel, card.variant)
    db.add(card); db.commit(); db.refresh(card)
    return card

@router.patch("/{card_uuid}", response_model=CardOut)
def update_card(card_uuid: str, payload: CardUpdate, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.card_uuid == card_uuid, Card.deleted_at.is_(None)).first()
    if not card: raise HTTPException(404, "Card not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(card, k, v)
    card.updated_at = now()
    card.canonical_key = canon(card.year, card.brand, card.set_name, card.subset,
                               card.card_no, card.parallel, card.variant)
    db.add(card); db.commit(); db.refresh(card)
    return card

@router.delete("/{card_uuid}")
def delete_card(card_uuid: str, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.card_uuid == card_uuid, Card.deleted_at.is_(None)).first()
    if not card: raise HTTPException(404, "Card not found")
    card.deleted_at = now()
    db.add(card); db.commit()
    return {"ok": True}
