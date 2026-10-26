"""Vehicle catalogue models: Manufacturer, VehicleModel, VehicleVariant."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import FuelType, Transmission


class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    models: Mapped[List["VehicleModel"]] = relationship(back_populates="manufacturer")


class VehicleModel(Base):
    __tablename__ = "vehicle_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("manufacturers.id"), index=True)
    model_name: Mapped[str] = mapped_column(String(160), index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    body_type: Mapped[str] = mapped_column(String(60), index=True)  # SUV, Hatchback, Sedan...
    model_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    gallery_urls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array string
    status: Mapped[str] = mapped_column(String(30), default="available", index=True)  # available/upcoming/discontinued
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    manufacturer: Mapped["Manufacturer"] = relationship(back_populates="models")
    variants: Mapped[List["VehicleVariant"]] = relationship(
        back_populates="model", cascade="all, delete-orphan"
    )

    @property
    def active_variants(self) -> List["VehicleVariant"]:
        return [v for v in self.variants if v.active]

    @property
    def min_price(self) -> Optional[Decimal]:
        prices = [v.ex_showroom_price for v in self.active_variants if v.ex_showroom_price is not None]
        return min(prices) if prices else None

    @property
    def max_price(self) -> Optional[Decimal]:
        prices = [v.ex_showroom_price for v in self.active_variants if v.ex_showroom_price is not None]
        return max(prices) if prices else None


class VehicleVariant(Base):
    __tablename__ = "vehicle_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_model_id: Mapped[int] = mapped_column(ForeignKey("vehicle_models.id"), index=True)
    variant_name: Mapped[str] = mapped_column(String(160))
    fuel_type: Mapped[FuelType] = mapped_column(Enum(FuelType), index=True)
    transmission: Mapped[Transmission] = mapped_column(Enum(Transmission), index=True)
    ex_showroom_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True, index=True)

    # Engine & performance
    engine_displacement: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # cc
    power: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)  # e.g. "118 bhp @ 5500 rpm"
    torque: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    mileage: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # e.g. "18.5 kmpl"
    electric_range: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # km
    battery_capacity: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # kWh

    # Dimensions & capacity
    seating_capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    boot_space: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # litres
    ground_clearance: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # mm
    length_mm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    width_mm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height_mm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fuel_tank_capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Feature groups stored as JSON array strings
    safety_features: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comfort_features: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    infotainment_features: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    specification_source: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    model: Mapped["VehicleModel"] = relationship(back_populates="variants")
