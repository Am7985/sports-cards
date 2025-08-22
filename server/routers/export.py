from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import StringIO
import csv

from ..deps import get_db
from ..models import Card

router = APIRouter(prefix="/v1/export", tags=["export"])

@router.get("/cards.csv")
def export_cards(db: Session = Depends(get_db)):
    rows = db.query(Card).filter(Card.deleted_at.is_(None)).order_by(Card.created_at.asc()).all()
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["card_uuid","year","brand","set_name","subset","card_no","player","team","sport",
                "parallel","variant","print_run","notes","canonical_key","created_at","updated_at"])
    for c in rows:
        w.writerow([c.card_uuid,c.year,c.brand,c.set_name,c.subset,c.card_no,c.player,c.team,c.sport,
                    c.parallel,c.variant,c.print_run,c.notes,c.canonical_key,c.created_at,c.updated_at])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="cards.csv"'})
