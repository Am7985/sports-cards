from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from io import StringIO
import csv
from uuid import uuid4
from datetime import datetime
from ..deps import get_db
from ..models import Card

router = APIRouter(prefix="/v1/import", tags=["import"])
now = lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z"

@router.post("/cards.csv")
async def import_cards(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file")

    raw = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(StringIO(raw))
    created, errors = 0, 0
    for row in reader:
        try:
            card = Card(
                card_uuid=f"c_{uuid4()}",
                tenant_id="local", schema_version="v1",
                created_at=now(), updated_at=now(),
                year=int(row["year"]) if (row.get("year") or "").strip().isdigit() else None,
                brand=row.get("brand") or None,
                set_name=row.get("set_name") or None,
                subset=row.get("subset") or None,
                card_no=row.get("card_no") or None,
                player=row.get("player") or None,
                team=row.get("team") or None,
                sport=row.get("sport") or None,
                parallel=row.get("parallel") or None,
                variant=row.get("variant") or None,
                print_run=int(row["print_run"]) if (row.get("print_run") or "").strip().isdigit() else None,
                notes=row.get("notes") or None,
            )
            db.add(card); created += 1
        except Exception:
            errors += 1
    db.commit()
    return {"ok": True, "created": created, "errors": errors}
