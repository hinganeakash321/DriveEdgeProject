"""Dealer schemas."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import VerificationStatus


class DealerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dealer_name: str
    address: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    verification_status: VerificationStatus
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    manufacturer_names: List[str] = Field(default_factory=list)
    distance_km: Optional[float] = None

    @classmethod
    def from_model(cls, d, distance_km: Optional[float] = None) -> "DealerOut":
        return cls(
            id=d.id,
            dealer_name=d.dealer_name,
            address=d.address,
            city=d.city,
            state=d.state,
            postal_code=d.postal_code,
            latitude=d.latitude,
            longitude=d.longitude,
            verification_status=d.verification_status,
            contact_email=d.contact_email,
            contact_phone=d.contact_phone,
            manufacturer_names=[dm.manufacturer.name for dm in d.manufacturers if dm.manufacturer],
            distance_km=round(distance_km, 1) if distance_km is not None else None,
        )
