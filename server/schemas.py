# server/schemas.py
from pydantic import BaseModel
from typing import Optional

class CardBase(BaseModel):
    year: Optional[int] = None
    brand: Optional[str] = None
    set_name: Optional[str] = None
    subset: Optional[str] = None
    card_no: Optional[str] = None
    player: Optional[str] = None
    team: Optional[str] = None
    sport: Optional[str] = None
    parallel: Optional[str] = None
    variant: Optional[str] = None
    print_run: Optional[str] = None
    notes: Optional[str] = None

class CardCreate(CardBase):
    pass

class CardUpdate(CardBase):
    pass

class CardOut(CardBase):
    card_uuid: str
    canonical_key: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
