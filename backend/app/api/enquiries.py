"""Customer enquiry and quotation endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models import (
    CustomerActivity,
    CustomerEnquiry,
    Dealer,
    DealerManufacturer,
    EnquiryDealer,
    Quotation,
    User,
    VehicleVariant,
)
from app.models.enums import EnquiryStatus, QuotationStatus, UserRole
from app.schemas.enquiries import (
    EnquiryCreate,
    EnquiryDealerOut,
    EnquiryOut,
    QuotationOut,
    RequestQuotesRequest,
)
from app.services import notification_service as notify
from app.services import quotation_service as qsvc
from app.services.deps import require_role

router = APIRouter(tags=["enquiries"])

customer_only = require_role(UserRole.CUSTOMER)


def vehicle_label(db: Session, variant_id: Optional[int]) -> Optional[str]:
    if not variant_id:
        return None
    v = db.get(VehicleVariant, variant_id)
    if not v or not v.model:
        return None
    mfr = v.model.manufacturer.name if v.model.manufacturer else ""
    return f"{mfr} {v.model.model_name} {v.variant_name}".strip()


def _enquiry_out(db: Session, e: CustomerEnquiry) -> EnquiryOut:
    dealers = []
    for link in e.dealer_links:
        dealers.append(
            EnquiryDealerOut(
                id=link.id,
                dealer_id=link.dealer_id,
                dealer_name=link.dealer.dealer_name if link.dealer else "",
                response_status=link.response_status,
                sent_at=link.sent_at,
                viewed_at=link.viewed_at,
                responded_at=link.responded_at,
                has_quotation=link.quotation is not None,
            )
        )
    return EnquiryOut(
        id=e.id,
        customer_id=e.customer_id,
        vehicle_variant_id=e.vehicle_variant_id,
        vehicle_label=vehicle_label(db, e.vehicle_variant_id),
        location=e.location,
        message=e.message,
        status=e.status,
        created_at=e.created_at,
        updated_at=e.updated_at,
        dealers=dealers,
    )


def _enquiry_manufacturer_id(db: Session, variant_id: Optional[int]) -> Optional[int]:
    if not variant_id:
        return None
    v = db.get(VehicleVariant, variant_id)
    return v.model.manufacturer_id if v and v.model else None


def _fan_out(db: Session, enquiry: CustomerEnquiry, dealer_ids: List[int], customer: User):
    label = vehicle_label(db, enquiry.vehicle_variant_id)
    # Only fan out to dealers that actually sell this car's brand. Single-brand
    # showrooms mean a Tata enquiry must never reach a non-Tata dealership.
    mfr_id = _enquiry_manufacturer_id(db, enquiry.vehicle_variant_id)
    allowed_dealer_ids: Optional[set[int]] = None
    if mfr_id is not None:
        allowed_dealer_ids = {
            link.dealer_id
            for link in db.query(DealerManufacturer)
            .filter(DealerManufacturer.manufacturer_id == mfr_id)
            .all()
        }
    created = 0
    for did in set(dealer_ids):
        dealer = db.get(Dealer, did)
        if not dealer:
            continue
        if allowed_dealer_ids is not None and did not in allowed_dealer_ids:
            # Silently skip dealers that do not sell this brand.
            continue
        exists = (
            db.query(EnquiryDealer)
            .filter(EnquiryDealer.enquiry_id == enquiry.id, EnquiryDealer.dealer_id == did)
            .first()
        )
        if exists:
            continue
        db.add(EnquiryDealer(enquiry_id=enquiry.id, dealer_id=did, response_status="sent"))
        created += 1
        if dealer.contact_email:
            notify.dealer_enquiry_notification(dealer.contact_email, enquiry.id, label)
    if created:
        enquiry.status = EnquiryStatus.SENT_TO_DEALER
    return created


@router.post("/api/enquiries", response_model=EnquiryOut, status_code=201)
def create_enquiry(
    payload: EnquiryCreate,
    db: Session = Depends(get_db),
    customer: User = Depends(customer_only),
):
    if payload.vehicle_variant_id and not db.get(VehicleVariant, payload.vehicle_variant_id):
        raise HTTPException(status_code=404, detail="Vehicle variant not found")

    enquiry = CustomerEnquiry(
        customer_id=customer.id,
        vehicle_variant_id=payload.vehicle_variant_id,
        location=payload.location,
        message=payload.message,
        status=EnquiryStatus.REQUESTED,
    )
    db.add(enquiry)
    db.flush()

    if payload.dealer_ids:
        _fan_out(db, enquiry, payload.dealer_ids, customer)

    db.add(
        CustomerActivity(
            customer_id=customer.id,
            enquiry_id=enquiry.id,
            activity_type="enquiry_submitted",
            description=f"Enquiry #{enquiry.id} submitted",
        )
    )
    db.commit()
    db.refresh(enquiry)
    notify.enquiry_confirmation(customer.email, enquiry.id, vehicle_label(db, enquiry.vehicle_variant_id))
    return _enquiry_out(db, enquiry)


@router.post("/api/enquiries/{enquiry_id}/request-quotes", response_model=EnquiryOut)
def request_quotes(
    enquiry_id: int,
    payload: RequestQuotesRequest,
    db: Session = Depends(get_db),
    customer: User = Depends(customer_only),
):
    enquiry = db.get(CustomerEnquiry, enquiry_id)
    if not enquiry or enquiry.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    _fan_out(db, enquiry, payload.dealer_ids, customer)
    db.commit()
    db.refresh(enquiry)
    return _enquiry_out(db, enquiry)


@router.get("/api/enquiries", response_model=List[EnquiryOut])
def list_enquiries(db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    enquiries = (
        db.query(CustomerEnquiry)
        .options(selectinload(CustomerEnquiry.dealer_links).selectinload(EnquiryDealer.dealer))
        .filter(CustomerEnquiry.customer_id == customer.id)
        .order_by(CustomerEnquiry.created_at.desc())
        .all()
    )
    return [_enquiry_out(db, e) for e in enquiries]


@router.get("/api/enquiries/{enquiry_id}", response_model=EnquiryOut)
def get_enquiry(enquiry_id: int, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    enquiry = db.get(CustomerEnquiry, enquiry_id)
    if not enquiry or enquiry.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return _enquiry_out(db, enquiry)


# ---- Quotations (customer view) ----

def _quotation_out(db: Session, q: Quotation, is_lowest=False, score=None) -> QuotationOut:
    link = q.enquiry_dealer
    return QuotationOut(
        id=q.id,
        enquiry_dealer_id=q.enquiry_dealer_id,
        enquiry_id=link.enquiry_id if link else None,
        dealer_id=q.dealer_id,
        dealer_name=q.dealer.dealer_name if q.dealer else None,
        dealer_city=q.dealer.city if q.dealer else None,
        vehicle_variant_id=q.vehicle_variant_id,
        vehicle_label=vehicle_label(db, q.vehicle_variant_id),
        ex_showroom_price=q.ex_showroom_price,
        registration_charges=q.registration_charges,
        insurance_amount=q.insurance_amount,
        accessories_amount=q.accessories_amount,
        discount_amount=q.discount_amount,
        other_charges=q.other_charges,
        final_price=q.final_price,
        estimated_delivery=q.estimated_delivery,
        validity_date=q.validity_date,
        status=q.status,
        notes=q.notes,
        special_offer=q.special_offer,
        created_at=q.created_at,
        updated_at=q.updated_at,
        value_score=score,
        is_lowest=is_lowest,
    )


def _customer_quotations(db: Session, customer_id: int, enquiry_id: Optional[int] = None):
    query = (
        db.query(Quotation)
        .join(EnquiryDealer, Quotation.enquiry_dealer_id == EnquiryDealer.id)
        .join(CustomerEnquiry, EnquiryDealer.enquiry_id == CustomerEnquiry.id)
        .filter(CustomerEnquiry.customer_id == customer_id)
        .filter(Quotation.status != QuotationStatus.DRAFT)
    )
    if enquiry_id:
        query = query.filter(CustomerEnquiry.id == enquiry_id)
    return query.order_by(Quotation.final_price.asc()).all()


@router.get("/api/quotations", response_model=List[QuotationOut])
def list_quotations(
    enquiry_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    customer: User = Depends(customer_only),
):
    quotations = _customer_quotations(db, customer.id, enquiry_id)
    annotated = qsvc.annotate_comparison(quotations)
    return [_quotation_out(db, q, low, score) for q, low, score in annotated]


@router.get("/api/quotations/{quotation_id}", response_model=QuotationOut)
def get_quotation(quotation_id: int, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    q = db.get(Quotation, quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    # Ownership check through the enquiry.
    link = db.get(EnquiryDealer, q.enquiry_dealer_id)
    enquiry = db.get(CustomerEnquiry, link.enquiry_id) if link else None
    if not enquiry or enquiry.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _quotation_out(db, q)


@router.post("/api/quotations/compare", response_model=List[QuotationOut])
def compare_quotations(
    enquiry_id: int = Query(...),
    db: Session = Depends(get_db),
    customer: User = Depends(customer_only),
):
    quotations = _customer_quotations(db, customer.id, enquiry_id)
    if len(quotations) < 1:
        raise HTTPException(status_code=400, detail="No quotations to compare for this enquiry")
    annotated = qsvc.annotate_comparison(quotations)
    return [_quotation_out(db, q, low, score) for q, low, score in annotated]


@router.post("/api/quotations/{quotation_id}/prefer", response_model=QuotationOut)
def prefer_quotation(quotation_id: int, db: Session = Depends(get_db), customer: User = Depends(customer_only)):
    q = db.get(Quotation, quotation_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    link = db.get(EnquiryDealer, q.enquiry_dealer_id)
    enquiry = db.get(CustomerEnquiry, link.enquiry_id) if link else None
    if not enquiry or enquiry.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not qsvc.can_transition(q.status, QuotationStatus.PREFERRED):
        raise HTTPException(status_code=409, detail=f"Cannot mark a {q.status.value} quotation as preferred")

    # Unset any previously-preferred quotation on this enquiry.
    for other_link in enquiry.dealer_links:
        if other_link.quotation and other_link.quotation.status == QuotationStatus.PREFERRED:
            other_link.quotation.status = QuotationStatus.SUBMITTED
    q.status = QuotationStatus.PREFERRED
    enquiry.status = EnquiryStatus.PREFERRED
    db.add(
        CustomerActivity(
            customer_id=customer.id,
            enquiry_id=enquiry.id,
            quotation_id=q.id,
            activity_type="quotation_preferred",
            description=f"Marked quotation #{q.id} as preferred",
        )
    )
    db.commit()
    db.refresh(q)
    return _quotation_out(db, q)
