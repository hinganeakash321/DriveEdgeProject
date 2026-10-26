"""Catalogue query service: search, filter, paginate, compare vehicles."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Manufacturer, VehicleModel, VehicleVariant
from app.models.enums import FuelType, Transmission


@dataclass
class CarFilters:
    q: Optional[str] = None
    manufacturer_id: Optional[int] = None
    manufacturer_slug: Optional[str] = None
    body_type: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    seating_capacity: Optional[int] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    status: Optional[str] = None
    sort: str = "popular"
    page: int = 1
    page_size: int = 12


SORT_OPTIONS = {"price_asc", "price_desc", "name_asc", "name_desc", "popular"}


def _safe_enum(enum_cls, value):
    """Coerce a free-text value to an enum member, returning None if invalid.

    Keeps the catalogue query robust against unknown/invalid filter values from
    the public API or AI-extracted preferences (e.g. a hallucinated '<UNKNOWN>').
    """
    if value is None:
        return None
    try:
        return enum_cls(str(value).strip().lower())
    except ValueError:
        return None


def _base_query():
    return (
        select(VehicleModel)
        .join(Manufacturer, VehicleModel.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(VehicleModel.manufacturer),
            selectinload(VehicleModel.variants),
        )
        .where(VehicleModel.active.is_(True))
    )


def _apply_variant_filters(stmt, f: CarFilters):
    """Join to variants when variant-level filters are present."""
    variant_conditions = []
    fuel = _safe_enum(FuelType, f.fuel_type)
    if fuel is not None:
        variant_conditions.append(VehicleVariant.fuel_type == fuel)
    trans = _safe_enum(Transmission, f.transmission)
    if trans is not None:
        variant_conditions.append(VehicleVariant.transmission == trans)
    if f.seating_capacity:
        variant_conditions.append(VehicleVariant.seating_capacity == f.seating_capacity)
    if f.min_price is not None:
        variant_conditions.append(VehicleVariant.ex_showroom_price >= f.min_price)
    if f.max_price is not None:
        variant_conditions.append(VehicleVariant.ex_showroom_price <= f.max_price)

    if variant_conditions:
        stmt = stmt.where(
            VehicleModel.id.in_(
                select(VehicleVariant.vehicle_model_id).where(
                    VehicleVariant.active.is_(True), *variant_conditions
                )
            )
        )
    return stmt


def list_vehicles(db: Session, f: CarFilters):
    stmt = _base_query()

    if f.q:
        like = f"%{f.q.strip()}%"
        stmt = stmt.where(
            or_(
                VehicleModel.model_name.ilike(like),
                Manufacturer.name.ilike(like),
            )
        )
    if f.manufacturer_id:
        stmt = stmt.where(VehicleModel.manufacturer_id == f.manufacturer_id)
    if f.manufacturer_slug:
        stmt = stmt.where(Manufacturer.slug == f.manufacturer_slug)
    if f.body_type:
        stmt = stmt.where(VehicleModel.body_type == f.body_type)
    if f.status:
        stmt = stmt.where(VehicleModel.status == f.status)

    stmt = _apply_variant_filters(stmt, f)

    # Total count (distinct models).
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = db.execute(count_stmt).scalar_one()

    # Sorting.
    if f.sort == "name_asc":
        stmt = stmt.order_by(VehicleModel.model_name.asc())
    elif f.sort == "name_desc":
        stmt = stmt.order_by(VehicleModel.model_name.desc())
    else:
        stmt = stmt.order_by(VehicleModel.id.asc())

    page = max(f.page, 1)
    page_size = min(max(f.page_size, 1), 48)
    rows = (
        db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .unique()
        .all()
    )

    # Price sorting is computed from active variants (post-fetch for correctness).
    if f.sort == "price_asc":
        rows.sort(key=lambda m: (m.min_price is None, m.min_price or 0))
    elif f.sort == "price_desc":
        rows.sort(key=lambda m: (m.min_price is None, -(m.min_price or 0)))

    return rows, total, page, page_size


def get_vehicle(db: Session, vehicle_id: int) -> Optional[VehicleModel]:
    stmt = _base_query().where(VehicleModel.id == vehicle_id)
    return db.execute(stmt).scalars().unique().one_or_none()


def get_vehicle_by_slug(db: Session, slug: str) -> Optional[VehicleModel]:
    stmt = _base_query().where(VehicleModel.slug == slug)
    return db.execute(stmt).scalars().unique().one_or_none()


def get_variants(db: Session, vehicle_id: int) -> List[VehicleVariant]:
    return (
        db.query(VehicleVariant)
        .filter(VehicleVariant.vehicle_model_id == vehicle_id, VehicleVariant.active.is_(True))
        .order_by(VehicleVariant.ex_showroom_price.asc())
        .all()
    )


def get_similar(db: Session, vehicle: VehicleModel, limit: int = 4) -> List[VehicleModel]:
    """Similar = same body type, excluding itself, nearest starting price."""
    stmt = (
        _base_query()
        .where(VehicleModel.body_type == vehicle.body_type)
        .where(VehicleModel.id != vehicle.id)
    )
    candidates = db.execute(stmt).scalars().unique().all()
    ref = vehicle.min_price or Decimal(0)
    candidates.sort(key=lambda m: abs((m.min_price or Decimal(0)) - ref))
    return candidates[:limit]


def filter_options(db: Session):
    manufacturers = (
        db.query(Manufacturer).filter(Manufacturer.active.is_(True)).order_by(Manufacturer.name).all()
    )
    body_types = [
        r[0]
        for r in db.query(VehicleModel.body_type)
        .filter(VehicleModel.active.is_(True))
        .distinct()
        .order_by(VehicleModel.body_type)
        .all()
    ]
    seating = [
        r[0]
        for r in db.query(VehicleVariant.seating_capacity)
        .filter(VehicleVariant.seating_capacity.isnot(None), VehicleVariant.active.is_(True))
        .distinct()
        .order_by(VehicleVariant.seating_capacity)
        .all()
    ]
    price_min = db.query(func.min(VehicleVariant.ex_showroom_price)).filter(
        VehicleVariant.active.is_(True)
    ).scalar()
    price_max = db.query(func.max(VehicleVariant.ex_showroom_price)).filter(
        VehicleVariant.active.is_(True)
    ).scalar()
    total_models = db.query(func.count(VehicleModel.id)).filter(VehicleModel.active.is_(True)).scalar()
    total_manufacturers = db.query(func.count(Manufacturer.id)).filter(
        Manufacturer.active.is_(True)
    ).scalar()

    # model counts per manufacturer
    counts = dict(
        db.query(VehicleModel.manufacturer_id, func.count(VehicleModel.id))
        .filter(VehicleModel.active.is_(True))
        .group_by(VehicleModel.manufacturer_id)
        .all()
    )
    return {
        "manufacturers": manufacturers,
        "manufacturer_counts": counts,
        "body_types": body_types,
        "fuel_types": [f.value for f in FuelType],
        "transmissions": [t.value for t in Transmission],
        "seating_capacities": seating,
        "price_min": price_min,
        "price_max": price_max,
        "total_models": total_models,
        "total_manufacturers": total_manufacturers,
    }
