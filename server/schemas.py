# server/schemas.py
from pydantic import BaseModel
from typing import Optional
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

class OwnershipBase(BaseModel):
    card_uuid: str
    condition_type: Optional[str] = None   # RAW | GRADED
    grade_scale: Optional[str] = None      # RAW | PSA | BGS | SGC
    grade_value: Optional[str] = None
    cert_no: Optional[str] = None
    acquired_date: Optional[str] = None    # ISO8601 yyyy-mm-dd ok
    price_paid: Optional[float] = None
    currency: Optional[str] = "USD"
    source: Optional[str] = None
    location: Optional[str] = None
    quantity: int = 1
    status: Optional[str] = "OWNED"
    notes: Optional[str] = None

class OwnershipCreate(OwnershipBase): pass

class OwnershipOut(OwnershipBase):
    ownership_uuid: str
    created_at: str
    updated_at: str
    class Config: from_attributes = True