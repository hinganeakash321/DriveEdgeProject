"""Customer personalization endpoints: favourites, saved searches, recently viewed.

All endpoints are scoped to the authenticated customer. Ownership is enforced on
every read/write so one customer can never see or modify another's data.
"""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Favourite, RecentlyViewed, SavedSearch, User, VehicleModel
from app.models.enums import UserRole
from app.services.deps import require_role

router = APIRouter(tags=["customer"])

customer_only = require_role(UserRole.CUSTOMER)


def _model_summary(m: VehicleModel) -> dict:
    return {
        "vehicle_model_id": m.id,
        "model_name": m.model_name,
        "manufacturer_name": m.manufacturer.name if m.manufacturer else None,
        "body_type": m.body_type,
        "image_url": m.image_url,
        "min_price": float(m.min_price) if m.min_price is not None else None,
    }


# ---- Favourites ----

class FavouriteIn(BaseModel):
    vehicle_model_id: int


@router.get("/api/favourites")
def list_favourites(db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    favs = (
        db.query(Favourite)
        .filter(Favourite.user_id == customer.id)
        .order_by(Favourite.created_at.desc())
        .all()
    )
    out = []
    for f in favs:
        model = db.get(VehicleModel, f.vehicle_model_id)
        if model:
            out.append({"id": f.id, **_model_summary(model)})
    return out


@router.post("/api/favourites", status_code=201)
def add_favourite(payload: FavouriteIn, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    if not db.get(VehicleModel, payload.vehicle_model_id):
        raise HTTPException(status_code=404, detail="Vehicle model not found")
    existing = (
        db.query(Favourite)
        .filter(Favourite.user_id == customer.id, Favourite.vehicle_model_id == payload.vehicle_model_id)
        .first()
    )
    if existing:
        return {"id": existing.id, "created": False}
    fav = Favourite(user_id=customer.id, vehicle_model_id=payload.vehicle_model_id)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return {"id": fav.id, "created": True}


@router.delete("/api/favourites/{vehicle_model_id}", status_code=204)
def remove_favourite(vehicle_model_id: int, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    fav = (
        db.query(Favourite)
        .filter(Favourite.user_id == customer.id, Favourite.vehicle_model_id == vehicle_model_id)
        .first()
    )
    if fav:
        db.delete(fav)
        db.commit()
    return None


# ---- Saved searches ----

class SavedSearchIn(BaseModel):
    name: str
    query_params: dict = {}
    alert_enabled: bool = False


@router.get("/api/saved-searches")
def list_saved_searches(db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    rows = (
        db.query(SavedSearch)
        .filter(SavedSearch.user_id == customer.id)
        .order_by(SavedSearch.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "query_params": json.loads(s.query_params or "{}"),
            "alert_enabled": s.alert_enabled,
            "created_at": s.created_at,
        }
        for s in rows
    ]


@router.post("/api/saved-searches", status_code=201)
def create_saved_search(payload: SavedSearchIn, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    s = SavedSearch(
        user_id=customer.id,
        name=payload.name[:160],
        query_params=json.dumps(payload.query_params),
        alert_enabled=payload.alert_enabled,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id}


@router.delete("/api/saved-searches/{search_id}", status_code=204)
def delete_saved_search(search_id: int, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    s = db.get(SavedSearch, search_id)
    if not s or s.user_id != customer.id:
        raise HTTPException(status_code=404, detail="Saved search not found")
    db.delete(s)
    db.commit()
    return None


# ---- Recently viewed ----

class RecentlyViewedIn(BaseModel):
    vehicle_model_id: int


@router.get("/api/recently-viewed")
def list_recently_viewed(
    limit: int = 10, db: Session = Depends(get_db), customer: User = Depends(customer_only)
):
    rows = (
        db.query(RecentlyViewed)
        .filter(RecentlyViewed.user_id == customer.id)
        .order_by(RecentlyViewed.viewed_at.desc())
        .limit(min(limit, 50))
        .all()
    )
    out = []
    seen = set()
    for r in rows:
        if r.vehicle_model_id in seen:
            continue
        seen.add(r.vehicle_model_id)
        model = db.get(VehicleModel, r.vehicle_model_id)
        if model:
            out.append({"id": r.id, "viewed_at": r.viewed_at, **_model_summary(model)})
    return out


@router.post("/api/recently-viewed", status_code=201)
def record_recently_viewed(
    payload: RecentlyViewedIn, db: Session = Depends(get_db), customer: User = Depends(customer_only)
):
    if not db.get(VehicleModel, payload.vehicle_model_id):
        raise HTTPException(status_code=404, detail="Vehicle model not found")
    db.add(RecentlyViewed(user_id=customer.id, vehicle_model_id=payload.vehicle_model_id))
    db.commit()
    return {"ok": True}
