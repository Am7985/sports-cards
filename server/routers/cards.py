# server/routers/cards.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from uuid import uuid4
from datetime import datetime
import re

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

# ---------- POWERED SEARCH (order-agnostic, multi-attribute) ----------
def apply_tokenized_search(query, q: str):
    """
    Split q into tokens and AND them together; for each token, OR across
    the relevant text columns. If the token is all digits, additionally
    match Card.year == int(token).
    """
    if not q:
        return query

    # tokens: words/numbers only, lowercased
    tokens = re.findall(r"[A-Za-z0-9]+", q.lower())
    if not tokens:
        return query

    # Columns to OR together for each token
    cols = [
        Card.player, Card.brand, Card.set_name, Card.subset,
        Card.card_no, Card.team, Card.sport, Card.parallel, Card.variant,
        Card.notes,
    ]

    for t in tokens:
        like = f"%{t}%"
        disj = or_(*[c.ilike(like) for c in cols])
        if t.isdigit():
            try:
                disj = or_(disj, Card.year == int(t))
            except ValueError:
                pass
        query = query.filter(disj)

    return query

# ---------- CRUD & LIST ----------
@router.get("")  # returning dict -> don't force response_model
def list_cards(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    page: int = 1,
    page_size: int = 50,
    sort: str = "updated_at",   # updated_at, created_at, year, player, brand, set_name, card_no
    order: str = "desc",        # asc|desc
    wishlisted: Optional[bool] = Query(None),
):
    page = max(1, page)
    page_size = min(max(1, page_size), 200)

    query = db.query(Card).filter(Card.deleted_at.is_(None))

    if wishlisted is not None:
        query = query.filter(Card.wishlisted == wishlisted)

    if q:
        query = apply_tokenized_search(query, q)

    # Sorting
    sort_col = getattr(Card, sort, Card.updated_at)
    if order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    # Let FastAPI serialize via Pydantic models
    items = [CardOut.model_validate(r, from_attributes=True) for r in rows]
    return {"items": items, "total": total}

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
    if not card:
        raise HTTPException(404, "Card not found")
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
    if not card:
        raise HTTPException(404, "Card not found")
    card.deleted_at = now()
    db.add(card); db.commit()
    return {"ok": True}

@router.post("/{card_uuid}/wishlist")
def set_wishlist(
    card_uuid: str,
    wishlisted: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    card = db.query(Card).filter(Card.card_uuid == card_uuid, Card.deleted_at.is_(None)).first()
    if not card:
        raise HTTPException(404, "card not found")
    card.wishlisted = bool(wishlisted)
    card.updated_at = now()
    db.commit()
    db.refresh(card)
    return {"ok": True, "card_uuid": card.card_uuid, "wishlisted": card.wishlisted}

# ---------- BROWSE HELPERS (used by your UI) ----------
@router.get("/browse/sports")
def browse_sports(db: Session = Depends(get_db)):
    rows = db.query(Card.sport).filter(
        Card.deleted_at.is_(None),
        Card.sport.isnot(None),
        Card.sport != "",
    ).distinct().all()
    sports = sorted({(r[0] or "").strip() for r in rows if (r[0] or "").strip()})
    return {"sports": sports}

@router.get("/browse/years")
def browse_years(
    sport: str = Query(...),
    db: Session = Depends(get_db),
):
    q = db.query(Card.year).filter(
        Card.deleted_at.is_(None),
        Card.sport.ilike(sport),
        Card.year.isnot(None),
    ).distinct()
    years = sorted({r[0] for r in q.all() if r[0] is not None}, reverse=True)
    return {"years": years}

@router.get("/browse/products")
def browse_products(
    sport: str = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    # brand + set_name pairs for the selected sport/year
    q = db.query(Card.brand, Card.set_name).filter(
        Card.deleted_at.is_(None),
        Card.sport.ilike(sport),
        Card.year == year,
    ).distinct()

    import re

    def norm(s: Optional[str]) -> str:
        if not s:
            return ""
        # collapse whitespace and trim
        return re.sub(r"\s+", " ", s).strip()

    labels: list[str] = []
    for brand, set_name in q.all():
        b = norm(brand)
        s = norm(set_name)

        if b and s:
            # If set_name already contains brand (anywhere, case-insensitive),
            # don’t duplicate the brand in the label.
            if s.lower().startswith(b.lower()) or b.lower() in s.lower():
                label = s
            else:
                label = f"{b} {s}"
        elif s:
            label = s
        elif b:
            label = b
        else:
            continue

        labels.append(label)

    # De-dupe case-insensitively while preserving original casing/order
    seen_lower = set()
    out: list[str] = []
    for L in labels:
        key = L.lower()
        if key not in seen_lower:
            seen_lower.add(key)
            out.append(L)

    return {"products": out}
