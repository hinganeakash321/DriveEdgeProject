"""Dealer-scoped read tools for the dealer conversational agent.

Every function is scoped to the authenticated dealer via ``dealer.id``. A dealer
can never see another dealership's enquiries, quotations or customers, and
competitor quotations are never read or exposed. These are plain Python helpers
(no raw SQL) and treat all inputs as untrusted.
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    CustomerEnquiry,
    Dealer,
    EnquiryDealer,
    Quotation,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import QuotationStatus


def _label(db: Session, variant_id: Optional[int]) -> Optional[str]:
    from app.api.enquiries import vehicle_label

    return vehicle_label(db, variant_id)


def pending_enquiries(db: Session, dealer: Dealer, limit: int = 10) -> List[dict]:
    """Enquiries assigned to this dealer that still await a quotation."""
    links = (
        db.query(EnquiryDealer)
        .filter(EnquiryDealer.dealer_id == dealer.id)
        .order_by(EnquiryDealer.sent_at.desc())
        .all()
    )
    out: List[dict] = []
    for link in links:
        if link.quotation is not None:
            continue  # already responded
        enquiry = link.enquiry
        out.append(
            {
                "enquiry_dealer_id": link.id,
                "enquiry_id": enquiry.id if enquiry else None,
                "customer_name": enquiry.customer.name if enquiry and enquiry.customer else None,
                "vehicle_label": _label(db, enquiry.vehicle_variant_id) if enquiry else None,
                "location": enquiry.location if enquiry else None,
                "response_status": link.response_status,
            }
        )
        if len(out) >= limit:
            break
    return out


def quotation_stats(db: Session, dealer: Dealer) -> dict:
    """Aggregate counts for this dealer's own quotations (no competitor data)."""
    total = db.query(func.count(Quotation.id)).filter(Quotation.dealer_id == dealer.id).scalar() or 0
    submitted = (
        db.query(func.count(Quotation.id))
        .filter(Quotation.dealer_id == dealer.id, Quotation.status != QuotationStatus.DRAFT)
        .scalar()
        or 0
    )
    accepted = (
        db.query(func.count(Quotation.id))
        .filter(Quotation.dealer_id == dealer.id, Quotation.status == QuotationStatus.ACCEPTED)
        .scalar()
        or 0
    )
    return {
        "total_quotations": total,
        "submitted": submitted,
        "accepted": accepted,
        "win_rate": round((accepted / submitted) * 100, 1) if submitted else 0.0,
    }


def pricing_context(db: Session, dealer: Dealer, vehicle_model_id: int) -> Optional[dict]:
    """Pricing guidance for a model: catalogue ex-showroom range + THIS dealer's
    own past quotes for that model. Never reads other dealers' quotations.
    """
    model = db.get(VehicleModel, vehicle_model_id)
    if not model:
        return None
    prices = [
        float(v.ex_showroom_price)
        for v in model.active_variants
        if v.ex_showroom_price is not None
    ]
    variant_ids = [v.id for v in model.variants]

    own_finals: List[float] = []
    if variant_ids:
        rows = (
            db.query(Quotation.final_price)
            .filter(
                Quotation.dealer_id == dealer.id,
                Quotation.vehicle_variant_id.in_(variant_ids),
                Quotation.status != QuotationStatus.DRAFT,
            )
            .all()
        )
        own_finals = [float(r[0]) for r in rows if r[0] is not None]

    return {
        "model": f"{model.manufacturer.name} {model.model_name}" if model.manufacturer else model.model_name,
        "ex_showroom_min": min(prices) if prices else None,
        "ex_showroom_max": max(prices) if prices else None,
        "your_quotes_count": len(own_finals),
        "your_avg_final_price": round(sum(own_finals) / len(own_finals), 2) if own_finals else None,
        "your_min_final_price": min(own_finals) if own_finals else None,
        "your_max_final_price": max(own_finals) if own_finals else None,
        "note": "Indicative guidance from catalogue ex-showroom prices and your own quotation history. Competitor pricing is not available.",
    }
