# server/models.py
from sqlalchemy import Column, String, Integer, Text, DateTime, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from .db import Base

def now_utc() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

class Card(Base):
    __tablename__ = "cards"
    card_uuid: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, default="local", index=True)
    schema_version: Mapped[str] = mapped_column(String, default="v1")
    created_at: Mapped[str] = mapped_column(String, default=now_utc)
    updated_at: Mapped[str] = mapped_column(String, default=now_utc)
    deleted_at: Mapped[str | None] = mapped_column(String, nullable=True)

    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    set_name: Mapped[str | None] = mapped_column(String, nullable=True)
    subset: Mapped[str | None] = mapped_column(String, nullable=True)
    card_no: Mapped[str | None] = mapped_column(String, nullable=True)
    player: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    team: Mapped[str | None] = mapped_column(String, nullable=True)
    sport: Mapped[str | None] = mapped_column(String, nullable=True)
    parallel: Mapped[str | None] = mapped_column(String, nullable=True)
    variant: Mapped[str | None] = mapped_column(String, nullable=True)
    print_run: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    canonical_key: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "canonical_key", name="ux_cards_tenant_canonical"),
    )

class Ownership(Base):
    __tablename__ = "ownership"
    ownership_uuid: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, default="local", index=True)
    schema_version: Mapped[str] = mapped_column(String, default="v1")
    created_at: Mapped[str] = mapped_column(String, default=now_utc)
    updated_at: Mapped[str] = mapped_column(String, default=now_utc)
    deleted_at: Mapped[str | None] = mapped_column(String, nullable=True)

    card_uuid: Mapped[str] = mapped_column(String, ForeignKey("cards.card_uuid"))
    condition_type: Mapped[str | None] = mapped_column(String)   # RAW | GRADED
    grade_scale: Mapped[str | None] = mapped_column(String)      # PSA | BGS | SGC | RAW
    grade_value: Mapped[str | None] = mapped_column(String)      # "10", "9.5", etc.
    cert_no: Mapped[str | None] = mapped_column(String)
    acquired_date: Mapped[str | None] = mapped_column(String)
    price_paid: Mapped[Numeric | None] = mapped_column(Numeric(12,2))
    currency: Mapped[str | None] = mapped_column(String, default="USD")
    source: Mapped[str | None] = mapped_column(String)
    location: Mapped[str | None] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str | None] = mapped_column(String)           # OWNED | SOLD | TRADED
    notes: Mapped[str | None] = mapped_column(Text)

class Price(Base):
    __tablename__ = "prices"
    price_uuid: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, default="local", index=True)
    schema_version: Mapped[str] = mapped_column(String, default="v1")
    created_at: Mapped[str] = mapped_column(String, default=now_utc)
    updated_at: Mapped[str] = mapped_column(String, default=now_utc)
    deleted_at: Mapped[str | None] = mapped_column(String, nullable=True)

    card_uuid: Mapped[str] = mapped_column(String, ForeignKey("cards.card_uuid"))
    condition_type: Mapped[str | None] = mapped_column(String)
    grade_scale: Mapped[str | None] = mapped_column(String)
    grade_value: Mapped[str | None] = mapped_column(String)
    sale_date: Mapped[str | None] = mapped_column(String)
    source_market: Mapped[str | None] = mapped_column(String)
    source_lot_url: Mapped[str | None] = mapped_column(Text)
    amount_all_in: Mapped[Numeric | None] = mapped_column(Numeric(12,2))
    currency: Mapped[str | None] = mapped_column(String, default="USD")
    fees_included: Mapped[str | None] = mapped_column(String)        # "Y" or "N"
    buyer_premium_pct: Mapped[str | None] = mapped_column(String)
    is_ask_or_bid: Mapped[str | None] = mapped_column(String)        # SOLD | ASK | BID
    confidence: Mapped[str | None] = mapped_column(String)           # HIGH|MEDIUM|LOW
    notes: Mapped[str | None] = mapped_column(Text)

class Media(Base):
    __tablename__ = "media"
    media_uuid: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, default="local", index=True)
    schema_version: Mapped[str] = mapped_column(String, default="v1")
    created_at: Mapped[str] = mapped_column(String, default=now_utc)
    updated_at: Mapped[str] = mapped_column(String, default=now_utc)
    deleted_at: Mapped[str | None] = mapped_column(String, nullable=True)

    ownership_uuid: Mapped[str | None] = mapped_column(String, ForeignKey("ownership.ownership_uuid"))
    card_uuid: Mapped[str | None] = mapped_column(String, ForeignKey("cards.card_uuid"))
    path: Mapped[str] = mapped_column(Text)      # relative path like "photos/..."
    kind: Mapped[str | None] = mapped_column(String)  # FRONT|BACK|SLAB_FRONT|...
    sha256: Mapped[str | None] = mapped_column(String)
    phash: Mapped[str | None] = mapped_column(String)
    width: Mapped[str | None] = mapped_column(String)
    height: Mapped[str | None] = mapped_column(String)
    filesize_bytes: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)
