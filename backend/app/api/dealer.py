"""Dealer portal endpoints (dealer-scoped, isolated)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import (
    CustomerActivity,
    CustomerEnquiry,
    Dealer,
    EnquiryDealer,
    Quotation,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import EnquiryStatus, QuotationStatus
from app.schemas.dealers import DealerOut
from pydantic import BaseModel
from app.schemas.enquiries import QuotationCreate, QuotationOut, QuotationUpdate
from app.services import notification_service as notify
from app.services import quotation_service as qsvc
from app.services.deps import get_current_dealer

router = APIRouter(prefix="/api/dealer", tags=["dealer"])


def _label(db: Session, variant_id: Optional[int]) -> Optional[str]:
    from app.api.enquiries import vehicle_label

    return vehicle_label(db, variant_id)


# ---- Profile ----

class DealerProfileUpdate(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


@router.get("/profile", response_model=DealerOut)
def dealer_profile(db: Session = Depends(get_db), dealer: Dealer = Depends(get_current_dealer)):
    return DealerOut.from_model(dealer)


@router.patch("/profile", response_model=DealerOut)
def update_dealer_profile(
    payload: DealerProfileUpdate,
    db: Session = Depends(get_db),
    dealer: Dealer = Depends(get_current_dealer),
):
    for field in ["address", "city", "state", "postal_code", "contact_email", "contact_phone"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(dealer, field, val)
    db.commit()
    db.refresh(dealer)
    return DealerOut.from_model(dealer)


@router.get("/enquiries")
def dealer_enquiries(db: Session = Depends(get_db), dealer: Dealer = Depends(get_current_dealer)):
    links = (
        db.query(EnquiryDealer)
        .filter(EnquiryDealer.dealer_id == dealer.id)
        .order_by(EnquiryDealer.sent_at.desc())
        .all()
    )
    out = []
    for link in links:
        enquiry = link.enquiry
        out.append(
            {
                "enquiry_dealer_id": link.id,
                "enquiry_id": enquiry.id,
                "customer_name": enquiry.customer.name if enquiry.customer else None,
                "vehicle_label": _label(db, enquiry.vehicle_variant_id),
                "vehicle_variant_id": enquiry.vehicle_variant_id,
                "location": enquiry.location,
                "message": enquiry.message,
                "response_status": link.response_status,
                "sent_at": link.sent_at,
                "has_quotation": link.quotation is not None,
                "quotation_id": link.quotation.id if link.quotation else None,
                "quotation_status": link.quotation.status.value if link.quotation else None,
                "your_final_price": float(link.quotation.final_price) if link.quotation else None,
                "market": _market_position(db, enquiry.id, dealer.id),
            }
        )
    return out


@router.get("/enquiries/{enquiry_dealer_id}")
def dealer_enquiry_detail(
    enquiry_dealer_id: int, db: Session = Depends(get_db), dealer: Dealer = Depends(get_current_dealer)
):
    link = db.get(EnquiryDealer, enquiry_dealer_id)
    if not link or link.dealer_id != dealer.id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    # Mark as viewed on first open.
    if link.viewed_at is None:
        link.viewed_at = datetime.now(timezone.utc)
        if link.response_status == "sent":
            link.response_status = "viewed"
        db.commit()
    enquiry = link.enquiry
    return {
        "enquiry_dealer_id": link.id,
        "enquiry_id": enquiry.id,
        "customer_name": enquiry.customer.name if enquiry.customer else None,
        "customer_phone": enquiry.customer.phone if enquiry.customer else None,
        "vehicle_label": _label(db, enquiry.vehicle_variant_id),
        "vehicle_variant_id": enquiry.vehicle_variant_id,
        "location": enquiry.location,
        "message": enquiry.message,
        "response_status": link.response_status,
        "market": _market_position(db, enquiry.id, dealer.id),
    }


def _market_position(db: Session, enquiry_id: int, dealer_id: int) -> dict:
    """Anonymized competitive position for an enquiry.

    Exposes ONLY aggregate figures (lowest competing price, count) and this
    dealer's own rank/price/gap. Never returns other dealers' identities,
    breakdowns, or any field that could de-anonymize a competitor.
    """
    live = {QuotationStatus.SUBMITTED, QuotationStatus.PREFERRED, QuotationStatus.ACCEPTED}
    rows = (
        db.query(Quotation.final_price, Quotation.dealer_id)
        .join(EnquiryDealer, Quotation.enquiry_dealer_id == EnquiryDealer.id)
        .filter(EnquiryDealer.enquiry_id == enquiry_id)
        .filter(Quotation.status.in_(live))
        .all()
    )
    finals = sorted(float(r[0]) for r in rows)
    total_quotes = len(finals)
    lowest = finals[0] if finals else None
    your_final = next((float(r[0]) for r in rows if r[1] == dealer_id), None)
    your_rank = None
    gap_to_lowest = None
    if your_final is not None and lowest is not None:
        your_rank = sorted(finals).index(your_final) + 1
        gap_to_lowest = round(your_final - lowest, 2)
    return {
        "total_quotes": total_quotes,
        "lowest_final_price": lowest,
        "your_final_price": your_final,
        "your_rank": your_rank,
        "gap_to_lowest": gap_to_lowest,
        "is_lowest": your_final is not None and lowest is not None and your_final == lowest,
    }


def _quotation_out(db: Session, q: Quotation) -> QuotationOut:
    from app.api.enquiries import _quotation_out as base

    return base(db, q)


@router.post("/quotations", response_model=QuotationOut, status_code=201)
def create_quotation(
    payload: QuotationCreate, db: Session = Depends(get_db), dealer: Dealer = Depends(get_current_dealer)
):
    link = db.get(EnquiryDealer, payload.enquiry_dealer_id)
    if not link or link.dealer_id != dealer.id:
        raise HTTPException(status_code=404, detail="Enquiry not assigned to this dealership")
    if link.quotation is not None:
        raise HTTPException(status_code=409, detail="A quotation already exists for this enquiry")
    if not db.get(VehicleVariant, payload.vehicle_variant_id):
        raise HTTPException(status_code=404, detail="Vehicle variant not found")

    q = Quotation(
        enquiry_dealer_id=link.id,
        dealer_id=dealer.id,
        vehicle_variant_id=payload.vehicle_variant_id,
        ex_showroom_price=payload.ex_showroom_price,
        registration_charges=payload.registration_charges,
        insurance_amount=payload.insurance_amount,
        accessories_amount=payload.accessories_amount,
        discount_amount=payload.discount_amount,
        other_charges=payload.other_charges,
        estimated_delivery=payload.estimated_delivery,
        validity_date=payload.validity_date,
        notes=payload.notes,
        special_offer=payload.special_offer,
        status=QuotationStatus.SUBMITTED if payload.submit else QuotationStatus.DRAFT,
    )
    qsvc.recompute(q)
    db.add(q)
    db.flush()

    if payload.submit:
        link.response_status = "responded"
        link.responded_at = datetime.now(timezone.utc)
        enquiry = link.enquiry
        enquiry.status = EnquiryStatus.QUOTATION_SUBMITTED
        if enquiry.customer and enquiry.customer.email:
            notify.quotation_received(enquiry.customer.email, enquiry.id, dealer.dealer_name)
        db.add(
            CustomerActivity(
                customer_id=enquiry.customer_id,
                enquiry_id=enquiry.id,
                quotation_id=q.id,
                activity_type="quotation_received",
                description=f"{dealer.dealer_name} submitted a quotation",
            )
        )
    db.commit()
    db.refresh(q)
    return _quotation_out(db, q)


@router.patch("/quotations/{quotation_id}", response_model=QuotationOut)
def update_quotation(
    quotation_id: int,
    payload: QuotationUpdate,
    db: Session = Depends(get_db),
    dealer: Dealer = Depends(get_current_dealer),
):
    q = db.get(Quotation, quotation_id)
    if not q or q.dealer_id != dealer.id:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if q.status in {QuotationStatus.ACCEPTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED}:
        raise HTTPException(status_code=409, detail=f"Cannot edit a {q.status.value} quotation")

    was_live = q.status in {QuotationStatus.SUBMITTED, QuotationStatus.PREFERRED}
    for field in [
        "ex_showroom_price",
        "registration_charges",
        "insurance_amount",
        "accessories_amount",
        "discount_amount",
        "other_charges",
        "estimated_delivery",
        "validity_date",
        "notes",
        "special_offer",
    ]:
        val = getattr(payload, field)
        if val is not None:
            setattr(q, field, val)
    qsvc.recompute(q)

    if payload.submit and q.status == QuotationStatus.DRAFT:
        if not qsvc.can_transition(q.status, QuotationStatus.SUBMITTED):
            raise HTTPException(status_code=409, detail="Invalid status transition")
        q.status = QuotationStatus.SUBMITTED
        link = db.get(EnquiryDealer, q.enquiry_dealer_id)
        link.response_status = "responded"
        link.responded_at = datetime.now(timezone.utc)
        link.enquiry.status = EnquiryStatus.QUOTATION_SUBMITTED
        if link.enquiry.customer and link.enquiry.customer.email:
            notify.quotation_received(link.enquiry.customer.email, link.enquiry.id, dealer.dealer_name)
    elif was_live:
        # Re-bid on an already-live quotation: log the improved offer and re-notify.
        link = db.get(EnquiryDealer, q.enquiry_dealer_id)
        enquiry = link.enquiry if link else None
        if enquiry:
            db.add(
                CustomerActivity(
                    customer_id=enquiry.customer_id,
                    enquiry_id=enquiry.id,
                    quotation_id=q.id,
                    activity_type="quotation_updated",
                    description=f"{dealer.dealer_name} improved their offer",
                )
            )
            if enquiry.customer and enquiry.customer.email:
                notify.quotation_received(enquiry.customer.email, enquiry.id, dealer.dealer_name)
    db.commit()
    db.refresh(q)
    return _quotation_out(db, q)


@router.get("/quotations", response_model=List[QuotationOut])
def dealer_quotations(db: Session = Depends(get_db), dealer: Dealer = Depends(get_current_dealer)):
    quotations = (
        db.query(Quotation)
        .filter(Quotation.dealer_id == dealer.id)
        .order_by(Quotation.created_at.desc())
        .all()
    )
    return [_quotation_out(db, q) for q in quotations]


# ---- Analytics ----

@router.get("/analytics")
def dealer_analytics(db: Session = Depends(get_db), dealer: Dealer = Depends(get_current_dealer)):
    total_enquiries = db.query(func.count(EnquiryDealer.id)).filter(
        EnquiryDealer.dealer_id == dealer.id
    ).scalar()
    responded = db.query(func.count(EnquiryDealer.id)).filter(
        EnquiryDealer.dealer_id == dealer.id, EnquiryDealer.response_status == "responded"
    ).scalar()
    total_quotations = db.query(func.count(Quotation.id)).filter(
        Quotation.dealer_id == dealer.id
    ).scalar()
    preferred = db.query(func.count(Quotation.id)).filter(
        Quotation.dealer_id == dealer.id, Quotation.status == QuotationStatus.PREFERRED
    ).scalar()

    # Status distribution
    status_rows = (
        db.query(Quotation.status, func.count(Quotation.id))
        .filter(Quotation.dealer_id == dealer.id)
        .group_by(Quotation.status)
        .all()
    )
    response_rate = round((responded / total_enquiries) * 100, 1) if total_enquiries else 0.0

    # Car-wise overview: top 5 models by number of enquiries routed to THIS dealer.
    # Dealer-scoped via EnquiryDealer.dealer_id; never leaks other dealers' data.
    top_model_rows = (
        db.query(VehicleModel.model_name, func.count(EnquiryDealer.id).label("cnt"))
        .join(CustomerEnquiry, EnquiryDealer.enquiry_id == CustomerEnquiry.id)
        .join(VehicleVariant, CustomerEnquiry.vehicle_variant_id == VehicleVariant.id)
        .join(VehicleModel, VehicleVariant.vehicle_model_id == VehicleModel.id)
        .filter(EnquiryDealer.dealer_id == dealer.id)
        .group_by(VehicleModel.id, VehicleModel.model_name)
        .order_by(func.count(EnquiryDealer.id).desc())
        .limit(5)
        .all()
    )
    return {
        "kpis": {
            "new_enquiries": total_enquiries - responded,
            "pending_responses": total_enquiries - responded,
            "quotations_submitted": total_quotations,
            "preferred_quotations": preferred,
            "response_rate": response_rate,
        },
        "quotation_status_distribution": [
            {"status": s.value, "count": c} for s, c in status_rows
        ],
        "top_models_by_enquiry": [
            {"model": name, "count": cnt} for name, cnt in top_model_rows
        ],
    }
