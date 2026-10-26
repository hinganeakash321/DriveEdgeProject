"""Administrator portal endpoints (admin-only)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import (
    AuditLog,
    CustomerEnquiry,
    Dealer,
    Manufacturer,
    Quotation,
    User,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import (
    AccountStatus,
    EnquiryStatus,
    QuotationStatus,
    UserRole,
    VerificationStatus,
)
from app.schemas.auth import UserOut
from app.services.deps import require_role
from app.services import notification_service as notify

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require_role(UserRole.ADMIN)


def _audit(db: Session, actor: User, action: str, entity_type: str, entity_id: int, detail: str = ""):
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=detail,
        )
    )


@router.get("/overview")
def overview(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return {
        "total_customers": db.query(func.count(User.id)).filter(User.role == UserRole.CUSTOMER).scalar(),
        "total_dealers": db.query(func.count(Dealer.id)).scalar(),
        "verified_dealers": db.query(func.count(Dealer.id)).filter(
            Dealer.verification_status == VerificationStatus.VERIFIED
        ).scalar(),
        "active_listings": db.query(func.count(VehicleModel.id)).filter(
            VehicleModel.active.is_(True)
        ).scalar(),
        "total_enquiries": db.query(func.count(CustomerEnquiry.id)).scalar(),
        "quotations_submitted": db.query(func.count(Quotation.id)).filter(
            Quotation.status != QuotationStatus.DRAFT
        ).scalar(),
        "pending_dealer_approvals": db.query(func.count(Dealer.id)).filter(
            Dealer.verification_status == VerificationStatus.PENDING
        ).scalar(),
    }


@router.get("/analytics")
def analytics(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    enquiry_status = (
        db.query(CustomerEnquiry.status, func.count(CustomerEnquiry.id))
        .group_by(CustomerEnquiry.status)
        .all()
    )
    approval_status = (
        db.query(Dealer.verification_status, func.count(Dealer.id))
        .group_by(Dealer.verification_status)
        .all()
    )
    # Manufacturer interest = enquiries grouped by manufacturer (via variant->model).
    manufacturer_interest = (
        db.query(Manufacturer.name, func.count(CustomerEnquiry.id))
        .join(VehicleModel, VehicleModel.manufacturer_id == Manufacturer.id)
        .join(VehicleVariant, VehicleVariant.vehicle_model_id == VehicleModel.id)
        .join(CustomerEnquiry, CustomerEnquiry.vehicle_variant_id == VehicleVariant.id)
        .group_by(Manufacturer.name)
        .order_by(func.count(CustomerEnquiry.id).desc())
        .limit(10)
        .all()
    )
    return {
        "enquiry_status": [{"status": s.value, "count": c} for s, c in enquiry_status],
        "dealer_approval_status": [{"status": s.value, "count": c} for s, c in approval_status],
        "manufacturer_interest": [{"manufacturer": m, "count": c} for m, c in manufacturer_interest],
    }


@router.get("/users", response_model=List[UserOut])
def list_users(role: Optional[UserRole] = None, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()


@router.get("/dealers")
def list_dealers_admin(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    dealers = db.query(Dealer).order_by(Dealer.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "dealer_name": d.dealer_name,
            "city": d.city,
            "verification_status": d.verification_status.value,
            "contact_email": d.contact_email,
            "owner_user_id": d.owner_user_id,
        }
        for d in dealers
    ]


class ApprovalRequest(BaseModel):
    approve: bool


@router.patch("/dealers/{dealer_id}/approval")
def set_dealer_approval(
    dealer_id: int,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    dealer = db.get(Dealer, dealer_id)
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    dealer.verification_status = (
        VerificationStatus.VERIFIED if payload.approve else VerificationStatus.REJECTED
    )
    if dealer.owner_user_id:
        owner = db.get(User, dealer.owner_user_id)
        if owner and payload.approve:
            owner.status = AccountStatus.ACTIVE
    _audit(db, admin, "dealer_approval", "dealer", dealer.id, f"approve={payload.approve}")
    if dealer.contact_email:
        notify.dealer_approval(dealer.contact_email, payload.approve)
    db.commit()
    return {"detail": "Updated", "verification_status": dealer.verification_status.value}


@router.get("/enquiries")
def admin_enquiries(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    enquiries = db.query(CustomerEnquiry).order_by(CustomerEnquiry.created_at.desc()).limit(100).all()
    return [
        {
            "id": e.id,
            "customer_name": e.customer.name if e.customer else None,
            "status": e.status.value,
            "dealer_count": len(e.dealer_links),
            "created_at": e.created_at,
        }
        for e in enquiries
    ]


@router.get("/quotations")
def admin_quotations(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    quotations = db.query(Quotation).order_by(Quotation.created_at.desc()).limit(100).all()
    return [
        {
            "id": q.id,
            "dealer_name": q.dealer.dealer_name if q.dealer else None,
            "final_price": float(q.final_price),
            "status": q.status.value,
            "created_at": q.created_at,
        }
        for q in quotations
    ]


# ---- Catalogue management (create manufacturers/models/variants) ----

class ManufacturerIn(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = None
    active: bool = True


@router.post("/manufacturers", status_code=201)
def create_manufacturer(payload: ManufacturerIn, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if db.query(Manufacturer).filter(Manufacturer.slug == payload.slug).first():
        raise HTTPException(status_code=409, detail="Manufacturer slug already exists")
    m = Manufacturer(**payload.model_dump())
    db.add(m)
    db.flush()
    _audit(db, admin, "create_manufacturer", "manufacturer", m.id, payload.name)
    db.commit()
    return {"id": m.id}


class ModelIn(BaseModel):
    manufacturer_id: int
    model_name: str
    slug: str
    body_type: str
    model_year: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str = "available"
    active: bool = True


@router.post("/models", status_code=201)
def create_model(payload: ModelIn, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if not db.get(Manufacturer, payload.manufacturer_id):
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    if db.query(VehicleModel).filter(VehicleModel.slug == payload.slug).first():
        raise HTTPException(status_code=409, detail="Model slug already exists")
    m = VehicleModel(**payload.model_dump())
    db.add(m)
    db.flush()
    _audit(db, admin, "create_model", "vehicle_model", m.id, payload.model_name)
    db.commit()
    return {"id": m.id}


@router.get("/models")
def list_models_admin(
    manufacturer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    query = db.query(VehicleModel)
    if manufacturer_id:
        query = query.filter(VehicleModel.manufacturer_id == manufacturer_id)
    models = query.order_by(VehicleModel.model_name).all()
    return [
        {
            "id": m.id,
            "model_name": m.model_name,
            "manufacturer_name": m.manufacturer.name if m.manufacturer else None,
            "body_type": m.body_type,
            "status": m.status,
            "active": m.active,
            "variant_count": len(m.variants),
            "has_image": bool(m.image_url),
        }
        for m in models
    ]


class ModelUpdate(BaseModel):
    status: Optional[str] = None
    active: Optional[bool] = None
    image_url: Optional[str] = None
    description: Optional[str] = None


@router.patch("/models/{model_id}")
def update_model(
    model_id: int, payload: ModelUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)
):
    m = db.get(VehicleModel, model_id)
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    for field in ["status", "active", "image_url", "description"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(m, field, val)
    _audit(db, admin, "update_model", "vehicle_model", m.id, m.model_name)
    db.commit()
    return {"id": m.id, "active": m.active, "status": m.status}


class VariantIn(BaseModel):
    vehicle_model_id: int
    variant_name: str
    fuel_type: str
    transmission: str
    ex_showroom_price: Optional[float] = None
    mileage: Optional[str] = None
    power: Optional[str] = None
    seating_capacity: Optional[int] = None


@router.post("/variants", status_code=201)
def create_variant(payload: VariantIn, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    from app.models.enums import FuelType, Transmission

    model = db.get(VehicleModel, payload.vehicle_model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    try:
        fuel = FuelType(payload.fuel_type)
        trans = Transmission(payload.transmission)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid fuel_type or transmission")
    v = VehicleVariant(
        vehicle_model_id=model.id,
        variant_name=payload.variant_name,
        fuel_type=fuel,
        transmission=trans,
        ex_showroom_price=payload.ex_showroom_price,
        mileage=payload.mileage,
        power=payload.power,
        seating_capacity=payload.seating_capacity,
    )
    db.add(v)
    db.flush()
    _audit(db, admin, "create_variant", "vehicle_variant", v.id, payload.variant_name)
    db.commit()
    return {"id": v.id}


@router.get("/audit-logs")
def audit_logs(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "actor_user_id": l.actor_user_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "detail": l.detail,
            "created_at": l.created_at,
        }
        for l in logs
    ]
