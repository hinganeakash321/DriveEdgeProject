"""CustomerEnquiry and EnquiryDealer (fan-out) models."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import EnquiryStatus


class CustomerEnquiry(Base):
    __tablename__ = "customer_enquiries"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vehicle_variant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vehicle_variants.id"), nullable=True, index=True
    )
    location: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[EnquiryStatus] = mapped_column(
        Enum(EnquiryStatus), default=EnquiryStatus.REQUESTED, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer = relationship("User", back_populates="enquiries")
    variant = relationship("VehicleVariant")
    dealer_links: Mapped[List["EnquiryDealer"]] = relationship(
        back_populates="enquiry", cascade="all, delete-orphan"
    )


class EnquiryDealer(Base):
    __tablename__ = "enquiry_dealers"

    id: Mapped[int] = mapped_column(primary_key=True)
    enquiry_id: Mapped[int] = mapped_column(ForeignKey("customer_enquiries.id"), index=True)
    dealer_id: Mapped[int] = mapped_column(ForeignKey("dealers.id"), index=True)
    response_status: Mapped[str] = mapped_column(String(30), default="sent", index=True)  # sent/viewed/responded
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    enquiry: Mapped["CustomerEnquiry"] = relationship(back_populates="dealer_links")
    dealer = relationship("Dealer")
    quotation = relationship("Quotation", back_populates="enquiry_dealer", uselist=False)
