"""Dealer discovery with haversine distance (DB-agnostic geo search)."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, selectinload

from app.models import Dealer, DealerManufacturer


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@dataclass
class DealerFilters:
    q: Optional[str] = None
    city: Optional[str] = None
    manufacturer_id: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = None
    page: int = 1
    page_size: int = 12


def list_dealers(db: Session, f: DealerFilters) -> Tuple[List[Tuple[Dealer, Optional[float]]], int]:
    query = db.query(Dealer).options(
        selectinload(Dealer.manufacturers).selectinload(DealerManufacturer.manufacturer)
    )
    if f.q:
        query = query.filter(Dealer.dealer_name.ilike(f"%{f.q.strip()}%"))
    if f.city:
        query = query.filter(Dealer.city.ilike(f"%{f.city.strip()}%"))
    if f.manufacturer_id:
        query = query.filter(
            Dealer.id.in_(
                db.query(DealerManufacturer.dealer_id).filter(
                    DealerManufacturer.manufacturer_id == f.manufacturer_id
                )
            )
        )

    dealers = query.all()

    # Distance computation / radius filtering done in Python (works on SQLite too).
    results: List[Tuple[Dealer, Optional[float]]] = []
    for d in dealers:
        distance = None
        if f.lat is not None and f.lng is not None and d.latitude is not None and d.longitude is not None:
            distance = haversine_km(f.lat, f.lng, d.latitude, d.longitude)
            if f.radius_km is not None and distance > f.radius_km:
                continue
        results.append((d, distance))

    if f.lat is not None and f.lng is not None:
        results.sort(key=lambda t: (t[1] is None, t[1] if t[1] is not None else 0))

    total = len(results)
    page = max(f.page, 1)
    page_size = min(max(f.page_size, 1), 48)
    start = (page - 1) * page_size
    return results[start : start + page_size], total
