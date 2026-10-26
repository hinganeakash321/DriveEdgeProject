"""Admin insights: platform-wide, aggregate-only narrative for administrators.

Admin-only. Operates purely on aggregate counts (no individual customer PII is
sent to the model). Claude (when available) turns the computed aggregates into a
short executive summary; otherwise a deterministic summary is returned.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.models import (
    CustomerEnquiry,
    Dealer,
    Manufacturer,
    Quotation,
    User,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import QuotationStatus, UserRole, VerificationStatus


def _metrics(db: Session) -> dict:
    total_customers = db.query(func.count(User.id)).filter(User.role == UserRole.CUSTOMER).scalar() or 0
    total_dealers = db.query(func.count(Dealer.id)).scalar() or 0
    verified_dealers = db.query(func.count(Dealer.id)).filter(
        Dealer.verification_status == VerificationStatus.VERIFIED
    ).scalar() or 0
    pending_dealers = db.query(func.count(Dealer.id)).filter(
        Dealer.verification_status == VerificationStatus.PENDING
    ).scalar() or 0
    total_models = db.query(func.count(VehicleModel.id)).filter(VehicleModel.active.is_(True)).scalar() or 0
    total_enquiries = db.query(func.count(CustomerEnquiry.id)).scalar() or 0
    quotations_submitted = db.query(func.count(Quotation.id)).filter(
        Quotation.status != QuotationStatus.DRAFT
    ).scalar() or 0

    top_manufacturers = (
        db.query(Manufacturer.name, func.count(CustomerEnquiry.id))
        .join(VehicleModel, VehicleModel.manufacturer_id == Manufacturer.id)
        .join(VehicleVariant, VehicleVariant.vehicle_model_id == VehicleModel.id)
        .join(CustomerEnquiry, CustomerEnquiry.vehicle_variant_id == VehicleVariant.id)
        .group_by(Manufacturer.name)
        .order_by(func.count(CustomerEnquiry.id).desc())
        .limit(5)
        .all()
    )
    return {
        "total_customers": total_customers,
        "total_dealers": total_dealers,
        "verified_dealers": verified_dealers,
        "pending_dealer_approvals": pending_dealers,
        "active_models": total_models,
        "total_enquiries": total_enquiries,
        "quotations_submitted": quotations_submitted,
        "top_manufacturers": [{"manufacturer": n, "enquiries": c} for n, c in top_manufacturers],
    }


def _deterministic_summary(m: dict) -> str:
    parts = [
        f"The marketplace has {m['total_customers']} customer(s), {m['total_dealers']} dealership(s) "
        f"({m['verified_dealers']} verified), and {m['active_models']} active model(s).",
        f"There are {m['total_enquiries']} enquiry(ies) and {m['quotations_submitted']} submitted "
        "quotation(s).",
    ]
    if m["pending_dealer_approvals"] > 0:
        parts.append(f"{m['pending_dealer_approvals']} dealership(s) are pending approval and need review.")
    if m["top_manufacturers"]:
        top = ", ".join(f"{t['manufacturer']} ({t['enquiries']})" for t in m["top_manufacturers"][:3])
        parts.append(f"Most enquired manufacturers: {top}.")
    return " ".join(parts)


def run_admin_insights(db: Session, message: Optional[str] = None) -> dict:
    m = _metrics(db)
    deterministic = _deterministic_summary(m)

    claude = get_claude()
    if claude.available:
        system = (
            "You are an analytics assistant for the administrator of the DriveEdge car "
            "marketplace. You receive only platform-wide aggregate metrics (no personal customer "
            "data). Write a concise executive summary (3-5 sentences) highlighting health, risks, "
            "and one or two recommended actions. Do not invent numbers beyond those provided."
        )
        user = (
            f"Metrics: {m}. "
            + (f"The admin asked: {message!r}. " if message else "")
            + "Write the summary."
        )
        try:
            reply = claude.invoke(system, user)
            return {"metrics": m, "summary": reply.strip(), "ai_generated": True}
        except ClaudeUnavailable:
            pass
    return {"metrics": m, "summary": deterministic, "ai_generated": False}
