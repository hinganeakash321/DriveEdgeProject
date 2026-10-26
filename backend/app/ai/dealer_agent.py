"""Dealer conversational agent.

Classifies a dealer's message and routes to dealer-scoped handlers. All data is
restricted to the authenticated dealer's own dealership; Claude only writes
narratives from already-computed, authorized facts. Deterministic fallback is
used when Claude is unavailable. Side effects are out of scope here (read-only).
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.ai import comparison, dealer_tools
from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.ai.dealer_assistant import run_dealer_assistant
from app.ai.schemas import ChatData, DealerIntent, StructuredChatResponse
from app.models import Dealer

_PERF_KW = ("perform", "how am i doing", "metrics", "win rate", "response rate", "stats", "summary")
_ENQUIRY_KW = ("enquiry", "enquiries", "inquiry", "inquiries", "lead", "leads", "pending", "respond")
_QUOTE_KW = ("quotation", "quote", "draft", "on-road", "breakup", "discount", "note")
_PRICING_KW = ("price", "pricing", "competitive", "how much", "charge", "ex-showroom", "ex showroom")


def classify(message: str) -> DealerIntent:
    decision = _ai_classify(message)
    if decision is not None:
        return decision
    return _heuristic_classify(message)


def _heuristic_classify(message: str) -> DealerIntent:
    text = message.lower()
    # Order matters: pricing and quotation drafting are more specific than enquiries.
    if any(k in text for k in _PRICING_KW):
        return DealerIntent.pricing_help
    if any(k in text for k in _QUOTE_KW):
        return DealerIntent.quotation_help
    if any(k in text for k in _ENQUIRY_KW):
        return DealerIntent.enquiries
    if any(k in text for k in _PERF_KW):
        return DealerIntent.performance
    return DealerIntent.general


def _ai_classify(message: str) -> Optional[DealerIntent]:
    claude = get_claude()
    if not claude.available:
        return None

    from pydantic import BaseModel

    class _Decision(BaseModel):
        intent: DealerIntent = DealerIntent.general

    system = (
        "You route a car dealership user's message for the DriveEdge dealer assistant. "
        "Intents: performance (how is my dealership doing, metrics), enquiries (view/triage "
        "assigned customer enquiries/leads), quotation_help (draft or explain a quotation / "
        "on-road breakup), pricing_help (what price to offer, competitiveness), general. "
        "Pick exactly one."
    )
    try:
        return claude.structured(system, message, _Decision).intent
    except ClaudeUnavailable:
        return None


# ---------------- handlers ----------------


def _handle_performance(db: Session, dealer: Dealer, message: str) -> StructuredChatResponse:
    result = run_dealer_assistant(db, dealer, message=message)
    return StructuredChatResponse(
        intent=DealerIntent.performance.value,
        message=result["summary"],
        ai_generated=result["ai_generated"],
    )


def _handle_enquiries(db: Session, dealer: Dealer, message: str) -> StructuredChatResponse:
    pending = dealer_tools.pending_enquiries(db, dealer)
    if not pending:
        return StructuredChatResponse(
            intent=DealerIntent.enquiries.value,
            message="You have no pending enquiries awaiting a quotation right now.",
        )
    msg = (
        f"You have {len(pending)} enquiry(ies) awaiting a quotation. Responding quickly tends to "
        "improve conversion."
    )
    return StructuredChatResponse(
        intent=DealerIntent.enquiries.value,
        message=msg,
        data=ChatData(enquiries=pending),
    )


def _handle_pricing(db: Session, dealer: Dealer, message: str) -> StructuredChatResponse:
    ids = comparison.resolve_from_text(db, message, limit=1)
    if not ids:
        return StructuredChatResponse(
            intent=DealerIntent.pricing_help.value,
            message=(
                "Which model do you want pricing guidance for? Mention it by name, e.g. "
                "'What should I price the Tata Nexon at?'."
            ),
            clarification_required=True,
        )
    ctx = dealer_tools.pricing_context(db, dealer, ids[0])
    if not ctx:
        return StructuredChatResponse(
            intent=DealerIntent.pricing_help.value,
            message="I could not find that model in the catalogue.",
        )
    claude = get_claude()
    if claude.available:
        system = (
            "You advise a car dealership on pricing for the Indian market. Use ONLY the provided "
            "facts (catalogue ex-showroom range and THIS dealer's own quote history). Never claim "
            "to know competitor prices. Give practical, concise guidance; label everything indicative."
        )
        try:
            reply = claude.invoke(system, f"Facts: {ctx}. Question: {message}")
            return StructuredChatResponse(
                intent=DealerIntent.pricing_help.value, message=reply.strip(), ai_generated=True
            )
        except ClaudeUnavailable:
            pass
    # Deterministic summary.
    lo, hi = ctx.get("ex_showroom_min"), ctx.get("ex_showroom_max")
    parts = [f"{ctx['model']}:"]
    if lo is not None:
        parts.append(
            f"catalogue ex-showroom ranges from Rs {lo:,.0f}"
            + (f" to Rs {hi:,.0f}" if hi and hi != lo else "")
            + "."
        )
    if ctx.get("your_quotes_count"):
        parts.append(
            f"Across your {ctx['your_quotes_count']} past quote(s) your final prices ranged Rs "
            f"{ctx['your_min_final_price']:,.0f}-{ctx['your_max_final_price']:,.0f} "
            f"(avg Rs {ctx['your_avg_final_price']:,.0f})."
        )
    else:
        parts.append("You have not quoted this model before.")
    parts.append(ctx["note"])
    return StructuredChatResponse(
        intent=DealerIntent.pricing_help.value, message=" ".join(parts), ai_generated=False
    )


def _handle_quotation_help(db: Session, dealer: Dealer, message: str) -> StructuredChatResponse:
    claude = get_claude()
    stats = dealer_tools.quotation_stats(db, dealer)
    if claude.available:
        system = (
            "You help a car dealership draft and explain customer quotations for the Indian market. "
            "Explain the on-road components (ex-showroom, registration, insurance, accessories, "
            "discount, other charges) and good practices. Never invent specific prices, taxes or "
            "discounts; tell the dealer which figures they must fill in themselves."
        )
        try:
            reply = claude.invoke(system, f"Dealer quote stats: {stats}. Request: {message}")
            return StructuredChatResponse(
                intent=DealerIntent.quotation_help.value, message=reply.strip(), ai_generated=True
            )
        except ClaudeUnavailable:
            pass
    return StructuredChatResponse(
        intent=DealerIntent.quotation_help.value,
        message=(
            "A clear on-road quotation lists: ex-showroom price, registration (RTO) charges, "
            "insurance, accessories, any discount, and other charges, with a final on-road total "
            "and a validity date. Fill each figure from your dealership's current rates. You can "
            "prepare one from the Enquiries tab."
        ),
        ai_generated=False,
    )


def _handle_general(db: Session, dealer: Dealer, message: str) -> StructuredChatResponse:
    claude = get_claude()
    stats = dealer_tools.quotation_stats(db, dealer)
    pending = dealer_tools.pending_enquiries(db, dealer, limit=5)
    context = {"dealership": dealer.dealer_name, "quote_stats": stats, "pending_enquiries": len(pending)}
    if claude.available:
        system = (
            "You are the DriveEdge assistant for a car dealership. Help with their workflow: "
            "enquiries, quotations and performance. Use ONLY the provided context as "
            "authoritative; never invent numbers or reference other dealerships. Be concise."
        )
        try:
            reply = claude.invoke(system, f"Context: {context}. Question: {message}")
            return StructuredChatResponse(
                intent=DealerIntent.general.value, message=reply.strip(), ai_generated=True
            )
        except ClaudeUnavailable:
            pass
    return StructuredChatResponse(
        intent=DealerIntent.general.value,
        message=(
            "I can help you review performance, triage pending enquiries, draft quotations, and "
            "think through competitive pricing. What would you like to do?"
        ),
    )


def dispatch(db: Session, dealer: Dealer, intent: DealerIntent, message: str) -> StructuredChatResponse:
    if intent == DealerIntent.performance:
        return _handle_performance(db, dealer, message)
    if intent == DealerIntent.enquiries:
        return _handle_enquiries(db, dealer, message)
    if intent == DealerIntent.pricing_help:
        return _handle_pricing(db, dealer, message)
    if intent == DealerIntent.quotation_help:
        return _handle_quotation_help(db, dealer, message)
    return _handle_general(db, dealer, message)


def run_dealer_chat(
    db: Session, dealer: Dealer, message: str, history: Optional[List[dict]] = None
) -> StructuredChatResponse:
    try:
        intent = classify(message)
        return dispatch(db, dealer, intent, message)
    except Exception as exc:  # pragma: no cover - defensive
        return StructuredChatResponse(
            intent=DealerIntent.general.value,
            message="Something went wrong handling that. Please try rephrasing.",
            error=str(exc),
        )
