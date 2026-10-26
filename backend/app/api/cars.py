"""Public catalogue endpoints."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.cars import (
    CompareRequest,
    CompareVariantsRequest,
    FilterOptions,
    ManufacturerOut,
    VariantOut,
    VehicleCardOut,
    VehicleDetailOut,
)
from app.schemas.common import DISCLAIMER, Page
from app.services import catalogue_service as cat
from app.services.catalogue_service import CarFilters

router = APIRouter(prefix="/api/cars", tags=["cars"])


@router.get("", response_model=Page[VehicleCardOut])
def list_cars(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    manufacturer_id: Optional[int] = None,
    manufacturer_slug: Optional[str] = None,
    body_type: Optional[str] = None,
    fuel_type: Optional[str] = None,
    transmission: Optional[str] = None,
    seating_capacity: Optional[int] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    status: Optional[str] = None,
    sort: str = Query("popular"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
):
    filters = CarFilters(
        q=q,
        manufacturer_id=manufacturer_id,
        manufacturer_slug=manufacturer_slug,
        body_type=body_type,
        fuel_type=fuel_type,
        transmission=transmission,
        seating_capacity=seating_capacity,
        min_price=min_price,
        max_price=max_price,
        status=status,
        sort=sort if sort in cat.SORT_OPTIONS else "popular",
        page=page,
        page_size=page_size,
    )
    rows, total, page, page_size = cat.list_vehicles(db, filters)
    return Page[VehicleCardOut](
        items=[VehicleCardOut.from_model(m) for m in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/filters", response_model=FilterOptions)
def get_filters(db: Session = Depends(get_db)):
    data = cat.filter_options(db)
    manufacturers = [
        ManufacturerOut(
            id=m.id,
            name=m.name,
            slug=m.slug,
            logo_url=m.logo_url,
            description=m.description,
            country=m.country,
            active=m.active,
            model_count=data["manufacturer_counts"].get(m.id, 0),
        )
        for m in data["manufacturers"]
    ]
    return FilterOptions(
        manufacturers=manufacturers,
        body_types=data["body_types"],
        fuel_types=data["fuel_types"],
        transmissions=data["transmissions"],
        seating_capacities=data["seating_capacities"],
        price_min=data["price_min"],
        price_max=data["price_max"],
        total_models=data["total_models"],
        total_manufacturers=data["total_manufacturers"],
    )


def _resolve(db: Session, vehicle_id_or_slug: str):
    if vehicle_id_or_slug.isdigit():
        vehicle = cat.get_vehicle(db, int(vehicle_id_or_slug))
    else:
        vehicle = cat.get_vehicle_by_slug(db, vehicle_id_or_slug)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.get("/{vehicle_id}", response_model=VehicleDetailOut)
def get_car(vehicle_id: str, db: Session = Depends(get_db)):
    vehicle = _resolve(db, vehicle_id)
    out = VehicleDetailOut.from_model(vehicle)
    out.disclaimer = DISCLAIMER
    return out


@router.get("/{vehicle_id}/variants", response_model=list[VariantOut])
def get_car_variants(vehicle_id: str, db: Session = Depends(get_db)):
    vehicle = _resolve(db, vehicle_id)
    return [VariantOut.from_model(v) for v in cat.get_variants(db, vehicle.id)]


@router.get("/{vehicle_id}/specifications", response_model=list[VariantOut])
def get_car_specifications(vehicle_id: str, db: Session = Depends(get_db)):
    # Specifications are variant-scoped; same payload as variants with full spec fields.
    vehicle = _resolve(db, vehicle_id)
    return [VariantOut.from_model(v) for v in cat.get_variants(db, vehicle.id)]


@router.get("/{vehicle_id}/similar", response_model=list[VehicleCardOut])
def get_similar(vehicle_id: str, db: Session = Depends(get_db)):
    vehicle = _resolve(db, vehicle_id)
    return [VehicleCardOut.from_model(m) for m in cat.get_similar(db, vehicle)]


@router.post("/compare", response_model=list[VehicleDetailOut])
def compare_cars(payload: CompareRequest, db: Session = Depends(get_db)):
    out = []
    for vid in payload.vehicle_ids:
        vehicle = cat.get_vehicle(db, vid)
        if vehicle:
            detail = VehicleDetailOut.from_model(vehicle)
            detail.disclaimer = DISCLAIMER
            out.append(detail)
    if len(out) < 2:
        raise HTTPException(status_code=400, detail="At least two valid vehicles are required to compare")
    return out


@router.post("/compare-variants", response_model=list[VariantOut])
def compare_variants(payload: CompareVariantsRequest, db: Session = Depends(get_db)):
    from app.models import VehicleVariant

    variants = (
        db.query(VehicleVariant).filter(VehicleVariant.id.in_(payload.variant_ids)).all()
    )
    if len(variants) < 2:
        raise HTTPException(status_code=400, detail="At least two valid variants are required to compare")
    return [VariantOut.from_model(v) for v in variants]
