"""Dealer assistant: grounded, dealer-scoped insights and drafting help.

Strictly scoped to the authenticated dealer's own data. It never reads another
dealership's enquiries, quotations or customers. All aggregates are computed in
Python from authorized queries; Claude (when available) only turns the already
computed, non-sensitive numbers into a short narrative. If Claude is unreachable
the deterministic summary is returned instead.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.models import Dealer, EnquiryDealer, Quotation
from app.models.enums import QuotationStatus


def _metrics(db: Session, dealer: Dealer) -> dict:
    total_enquiries = db.query(func.count(EnquiryDealer.id)).filter(
        EnquiryDealer.dealer_id == dealer.id
    ).scalar() or 0
    responded = db.query(func.count(EnquiryDealer.id)).filter(
        EnquiryDealer.dealer_id == dealer.id, EnquiryDealer.response_status == "responded"
    ).scalar() or 0
    pending = total_enquiries - responded
    total_quotations = db.query(func.count(Quotation.id)).filter(
        Quotation.dealer_id == dealer.id
    ).scalar() or 0
    preferred = db.query(func.count(Quotation.id)).filter(
        Quotation.dealer_id == dealer.id, Quotation.status == QuotationStatus.PREFERRED
    ).scalar() or 0
    accepted = db.query(func.count(Quotation.id)).filter(
        Quotation.dealer_id == dealer.id, Quotation.status == QuotationStatus.ACCEPTED
    ).scalar() or 0
    response_rate = round((responded / total_enquiries) * 100, 1) if total_enquiries else 0.0
    win_rate = round((accepted / total_quotations) * 100, 1) if total_quotations else 0.0
    return {
        "total_enquiries": total_enquiries,
        "pending_responses": pending,
        "responded": responded,
        "quotations_submitted": total_quotations,
        "preferred_quotations": preferred,
        "accepted_quotations": accepted,
        "response_rate": response_rate,
        "win_rate": win_rate,
    }


def _deterministic_summary(m: dict) -> str:
    tips = []
    if m["pending_responses"] > 0:
        tips.append(
            f"You have {m['pending_responses']} enquiry(ies) awaiting a quotation. "
            "Responding quickly tends to improve conversion."
        )
    if m["response_rate"] < 80 and m["total_enquiries"] >= 3:
        tips.append(
            f"Your response rate is {m['response_rate']}%. Submitting quotations to more "
            "enquiries can increase your win opportunities."
        )
    if m["quotations_submitted"] > 0 and m["win_rate"] < 30:
        tips.append(
            f"Your win rate is {m['win_rate']}%. Review pricing competitiveness and the "
            "clarity of your on-road breakup."
        )
    if not tips:
        tips.append("Your pipeline looks healthy. Keep responding promptly to new enquiries.")
    headline = (
        f"You have handled {m['total_enquiries']} enquiry(ies), submitted "
        f"{m['quotations_submitted']} quotation(s), with a {m['response_rate']}% response rate "
        f"and {m['win_rate']}% win rate."
    )
    return headline + " " + " ".join(tips)


def run_dealer_assistant(db: Session, dealer: Dealer, message: Optional[str] = None) -> dict:
    """Return dealer-scoped metrics plus a short narrative summary."""
    m = _metrics(db, dealer)
    deterministic = _deterministic_summary(m)

    claude = get_claude()
    if claude.available:
        system = (
            "You are a performance assistant for a car dealership on the DriveEdge marketplace. "
            "You are given this dealership's OWN aggregate metrics only. Never reference other "
            "dealerships or individual customers. Give a concise, practical summary (3-5 sentences) "
            "with concrete next actions. Do not invent numbers beyond those provided."
        )
        user = (
            f"Metrics: {m}. "
            + (f"The dealer asked: {message!r}. " if message else "")
            + "Write the summary."
        )
        try:
            reply = claude.invoke(system, user)
            return {"metrics": m, "summary": reply.strip(), "ai_generated": True}
        except ClaudeUnavailable:
            pass
    return {"metrics": m, "summary": deterministic, "ai_generated": False}
