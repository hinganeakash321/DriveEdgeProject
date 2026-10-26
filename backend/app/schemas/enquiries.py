"""Enquiry and quotation schemas."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EnquiryStatus, QuotationStatus


class EnquiryCreate(BaseModel):
    vehicle_variant_id: Optional[int] = None
    location: Optional[str] = Field(default=None, max_length=160)
    message: Optional[str] = Field(default=None, max_length=2000)
    dealer_ids: List[int] = Field(default_factory=list, max_length=10)


class RequestQuotesRequest(BaseModel):
    dealer_ids: List[int] = Field(min_length=1, max_length=10)


class EnquiryDealerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dealer_id: int
    dealer_name: str
    response_status: str
    sent_at: datetime
    viewed_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    has_quotation: bool = False


class EnquiryOut(BaseModel):
    id: int
    customer_id: int
    vehicle_variant_id: Optional[int] = None
    vehicle_label: Optional[str] = None
    location: Optional[str] = None
    message: Optional[str] = None
    status: EnquiryStatus
    created_at: datetime
    updated_at: datetime
    dealers: List[EnquiryDealerOut] = Field(default_factory=list)


class QuotationCreate(BaseModel):
    enquiry_dealer_id: int
    vehicle_variant_id: int
    ex_showroom_price: Decimal = Field(ge=0)
    registration_charges: Decimal = Field(default=Decimal(0), ge=0)
    insurance_amount: Decimal = Field(default=Decimal(0), ge=0)
    accessories_amount: Decimal = Field(default=Decimal(0), ge=0)
    discount_amount: Decimal = Field(default=Decimal(0), ge=0)
    other_charges: Decimal = Field(default=Decimal(0), ge=0)
    estimated_delivery: Optional[str] = None
    validity_date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    special_offer: Optional[str] = Field(default=None, max_length=280)
    submit: bool = False


class QuotationUpdate(BaseModel):
    ex_showroom_price: Optional[Decimal] = Field(default=None, ge=0)
    registration_charges: Optional[Decimal] = Field(default=None, ge=0)
    insurance_amount: Optional[Decimal] = Field(default=None, ge=0)
    accessories_amount: Optional[Decimal] = Field(default=None, ge=0)
    discount_amount: Optional[Decimal] = Field(default=None, ge=0)
    other_charges: Optional[Decimal] = Field(default=None, ge=0)
    estimated_delivery: Optional[str] = None
    validity_date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    special_offer: Optional[str] = Field(default=None, max_length=280)
    submit: Optional[bool] = None


class QuotationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    enquiry_dealer_id: int
    enquiry_id: Optional[int] = None
    dealer_id: int
    dealer_name: Optional[str] = None
    dealer_city: Optional[str] = None
    vehicle_variant_id: int
    vehicle_label: Optional[str] = None
    ex_showroom_price: Decimal
    registration_charges: Decimal
    insurance_amount: Decimal
    accessories_amount: Decimal
    discount_amount: Decimal
    other_charges: Decimal
    final_price: Decimal
    estimated_delivery: Optional[str] = None
    validity_date: Optional[date] = None
    status: QuotationStatus
    notes: Optional[str] = None
    special_offer: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    value_score: Optional[float] = None
    is_lowest: bool = False
