"""Public dealer discovery endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models import Dealer, DealerManufacturer
from app.schemas.common import Page
from app.schemas.dealers import DealerOut
from app.services.dealer_service import DealerFilters, list_dealers

router = APIRouter(prefix="/api/dealers", tags=["dealers"])


@router.get("", response_model=Page[DealerOut])
def get_dealers(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    city: Optional[str] = None,
    manufacturer_id: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
):
    filters = DealerFilters(
        q=q, city=city, manufacturer_id=manufacturer_id, lat=lat, lng=lng,
        radius_km=radius_km, page=page, page_size=page_size,
    )
    results, total = list_dealers(db, filters)
    return Page[DealerOut](
        items=[DealerOut.from_model(d, dist) for d, dist in results],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{dealer_id}", response_model=DealerOut)
def get_dealer(dealer_id: int, db: Session = Depends(get_db)):
    dealer = (
        db.query(Dealer)
        .options(selectinload(Dealer.manufacturers).selectinload(DealerManufacturer.manufacturer))
        .filter(Dealer.id == dealer_id)
        .first()
    )
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return DealerOut.from_model(dealer)
