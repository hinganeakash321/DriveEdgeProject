"""Shared enumerations used across models and schemas."""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    DEALER = "dealer"
    ADMIN = "admin"


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING = "pending"
    SUSPENDED = "suspended"


class FuelType(str, enum.Enum):
    PETROL = "petrol"
    DIESEL = "diesel"
    CNG = "cng"
    ELECTRIC = "electric"
    HYBRID = "hybrid"


class Transmission(str, enum.Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    AMT = "amt"
    CVT = "cvt"
    DCT = "dct"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class EnquiryStatus(str, enum.Enum):
    REQUESTED = "requested"
    SENT_TO_DEALER = "sent_to_dealer"
    QUOTATION_SUBMITTED = "quotation_submitted"
    PREFERRED = "preferred"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PREFERRED = "preferred"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
