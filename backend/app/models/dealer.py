"""Dealer and DealerManufacturer models."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import VerificationStatus


class Dealer(Base):
    __tablename__ = "dealers"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    dealer_name: Mapped[str] = mapped_column(String(200), index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.PENDING, index=True
    )
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="dealer")
    manufacturers: Mapped[List["DealerManufacturer"]] = relationship(
        back_populates="dealer", cascade="all, delete-orphan"
    )


class DealerManufacturer(Base):
    __tablename__ = "dealer_manufacturers"
    __table_args__ = (UniqueConstraint("dealer_id", "manufacturer_id", name="uq_dealer_manufacturer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    dealer_id: Mapped[int] = mapped_column(ForeignKey("dealers.id"), index=True)
    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("manufacturers.id"), index=True)

    dealer: Mapped["Dealer"] = relationship(back_populates="manufacturers")
    manufacturer = relationship("Manufacturer")
