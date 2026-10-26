"""Quotation model with decimal monetary fields."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import QuotationStatus


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    enquiry_dealer_id: Mapped[int] = mapped_column(ForeignKey("enquiry_dealers.id"), index=True, unique=True)
    dealer_id: Mapped[int] = mapped_column(ForeignKey("dealers.id"), index=True)
    vehicle_variant_id: Mapped[int] = mapped_column(ForeignKey("vehicle_variants.id"), index=True)

    ex_showroom_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    registration_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    insurance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    accessories_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    other_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    final_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, index=True)

    estimated_delivery: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    validity_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[QuotationStatus] = mapped_column(
        Enum(QuotationStatus), default=QuotationStatus.DRAFT, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    special_offer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    enquiry_dealer = relationship("EnquiryDealer", back_populates="quotation")
    dealer = relationship("Dealer")
    variant = relationship("VehicleVariant")
