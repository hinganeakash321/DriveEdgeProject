"""Catalogue schemas: manufacturers, models, variants, comparisons."""
from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FuelType, Transmission


def _parse_json_list(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [str(x) for x in data] if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


class ManufacturerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = None
    active: bool
    model_count: Optional[int] = None


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_model_id: int
    variant_name: str
    fuel_type: FuelType
    transmission: Transmission
    ex_showroom_price: Optional[Decimal] = None
    engine_displacement: Optional[int] = None
    power: Optional[str] = None
    torque: Optional[str] = None
    mileage: Optional[str] = None
    electric_range: Optional[int] = None
    battery_capacity: Optional[str] = None
    seating_capacity: Optional[int] = None
    boot_space: Optional[int] = None
    ground_clearance: Optional[int] = None
    length_mm: Optional[int] = None
    width_mm: Optional[int] = None
    height_mm: Optional[int] = None
    fuel_tank_capacity: Optional[int] = None
    safety_features: List[str] = Field(default_factory=list)
    comfort_features: List[str] = Field(default_factory=list)
    infotainment_features: List[str] = Field(default_factory=list)
    specification_source: Optional[str] = None
    last_verified_at: Optional[datetime] = None

    @classmethod
    def from_model(cls, v) -> "VariantOut":
        return cls(
            id=v.id,
            vehicle_model_id=v.vehicle_model_id,
            variant_name=v.variant_name,
            fuel_type=v.fuel_type,
            transmission=v.transmission,
            ex_showroom_price=v.ex_showroom_price,
            engine_displacement=v.engine_displacement,
            power=v.power,
            torque=v.torque,
            mileage=v.mileage,
            electric_range=v.electric_range,
            battery_capacity=v.battery_capacity,
            seating_capacity=v.seating_capacity,
            boot_space=v.boot_space,
            ground_clearance=v.ground_clearance,
            length_mm=v.length_mm,
            width_mm=v.width_mm,
            height_mm=v.height_mm,
            fuel_tank_capacity=v.fuel_tank_capacity,
            safety_features=_parse_json_list(v.safety_features),
            comfort_features=_parse_json_list(v.comfort_features),
            infotainment_features=_parse_json_list(v.infotainment_features),
            specification_source=v.specification_source,
            last_verified_at=v.last_verified_at,
        )


class VehicleCardOut(BaseModel):
    """Compact representation used in listing grids."""

    id: int
    manufacturer_id: int
    manufacturer_name: str
    model_name: str
    slug: str
    body_type: str
    image_url: Optional[str] = None
    status: str
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    fuel_types: List[str] = Field(default_factory=list)
    transmissions: List[str] = Field(default_factory=list)
    seating_capacities: List[int] = Field(default_factory=list)
    variant_count: int = 0

    @classmethod
    def from_model(cls, m) -> "VehicleCardOut":
        variants = m.active_variants
        return cls(
            id=m.id,
            manufacturer_id=m.manufacturer_id,
            manufacturer_name=m.manufacturer.name if m.manufacturer else "",
            model_name=m.model_name,
            slug=m.slug,
            body_type=m.body_type,
            image_url=m.image_url,
            status=m.status,
            min_price=m.min_price,
            max_price=m.max_price,
            fuel_types=sorted({v.fuel_type.value for v in variants}),
            transmissions=sorted({v.transmission.value for v in variants}),
            seating_capacities=sorted({v.seating_capacity for v in variants if v.seating_capacity}),
            variant_count=len(variants),
        )


class VehicleDetailOut(VehicleCardOut):
    model_year: Optional[int] = None
    description: Optional[str] = None
    gallery_urls: List[str] = Field(default_factory=list)
    variants: List[VariantOut] = Field(default_factory=list)
    last_updated_at: Optional[datetime] = None
    disclaimer: str = ""

    @classmethod
    def from_model(cls, m) -> "VehicleDetailOut":
        base = VehicleCardOut.from_model(m).model_dump()
        base.update(
            model_year=m.model_year,
            description=m.description,
            gallery_urls=_parse_json_list(m.gallery_urls),
            variants=[VariantOut.from_model(v) for v in m.active_variants],
            last_updated_at=m.last_updated_at,
        )
        return cls(**base)


class CompareRequest(BaseModel):
    vehicle_ids: List[int] = Field(min_length=2, max_length=4)


class CompareVariantsRequest(BaseModel):
    variant_ids: List[int] = Field(min_length=2, max_length=5)


class FilterOptions(BaseModel):
    manufacturers: List[ManufacturerOut]
    body_types: List[str]
    fuel_types: List[str]
    transmissions: List[str]
    seating_capacities: List[int]
    price_min: Optional[Decimal] = None
    price_max: Optional[Decimal] = None
    total_models: int
    total_manufacturers: int
