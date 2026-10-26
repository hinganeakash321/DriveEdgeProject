"""Supervisor: intent classification + routing to specialist agents/tools.

Claude (when available) classifies intent and extracts preferences into a typed
SupervisorDecision; otherwise a deterministic keyword classifier is used. All
filtering, authorization, money math and side effects stay in deterministic
backend tools -- the LLM never touches the database directly.
"""
from __future__ import annotations

import re
from typing import List, Optional

from sqlalchemy.orm import Session

from app.ai import comparison, tools
from app.ai.buying_assistant import run_buying_assistant
from app.ai.car_finder import _heuristic_extract, run_car_finder
from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.ai.schemas import (
    CarFinderRequest,
    ChatAction,
    ChatData,
    ExtractedPreferences,
    Intent,
    StructuredChatResponse,
    SupervisorDecision,
)
from app.models import User

_COMPARE_KW = ("compare", " vs ", " vs.", "versus", "difference between", "better between")
_DEALER_KW = ("dealer", "dealership", "showroom", "near me", "near ")
_QUOTE_KW = ("quotation", "quote", "offer", "on-road deal")
_ADVICE_KW = (
    "should i buy", "which car should", "petrol or diesel", "diesel or petrol",
    "petrol or cng", "ev or petrol", "running cost", "advice", "help me decide",
    "worth it", "pros and cons",
)


def _heuristic_decision(message: str) -> SupervisorDecision:
    text = message.lower()
    prefs = _heuristic_extract(CarFinderRequest(message=message))
    names = _extract_vehicle_names(message)

    # Precedence: quotation review (most specific) -> dealer search -> comparison.
    if any(k in text for k in _QUOTE_KW):
        return SupervisorDecision(intent=Intent.quote_review, preferences=prefs)
    if any(k in text for k in _DEALER_KW):
        return SupervisorDecision(intent=Intent.dealer_search, vehicle_names=names, preferences=prefs)
    if any(k in text for k in _COMPARE_KW) or len(names) >= 2:
        return SupervisorDecision(intent=Intent.comparison, vehicle_names=names, preferences=prefs)
    if any(k in text for k in _ADVICE_KW):
        return SupervisorDecision(intent=Intent.buying_advice, vehicle_names=names, preferences=prefs)
    # Default: treat as a vehicle search if there is any useful signal.
    if prefs.budget_max or prefs.body_type or prefs.fuel_type or "car" in text or "suv" in text or "find" in text or "suggest" in text:
        return SupervisorDecision(intent=Intent.vehicle_search, preferences=prefs)
    return SupervisorDecision(intent=Intent.unclear)


def _extract_vehicle_names(message: str) -> List[str]:
    """Pull likely 'Brand Model' phrases; also split on vs/and/or."""
    # Split comparison phrasing.
    parts = re.split(r"\b(?:vs\.?|versus|and|or|,)\b", message, flags=re.IGNORECASE)
    candidates = []
    for p in parts:
        # Capitalized word groups look like model names.
        for m in re.findall(r"[A-Z][a-zA-Z0-9]+(?:[-\s][A-Z0-9][a-zA-Z0-9]+)*", p):
            if len(m) > 2 and m.lower() not in {"compare", "which", "find", "show", "the", "best"}:
                candidates.append(m.strip())
    return candidates[:4]


def _ai_decision(message: str) -> Optional[SupervisorDecision]:
    claude = get_claude()
    if not claude.available:
        return None
    system = (
        "You are the routing supervisor for DriveEdge, an Indian car marketplace. Classify the "
        "user's message into one intent and extract any vehicle names and preferences. Intents: "
        "vehicle_search (find/suggest cars), comparison (compare 2+ models), buying_advice "
        "(powertrain/running-cost/decision help), dealer_search (find dealerships), quote_review "
        "(review/compare the user's own dealer quotations, by car model or 'all my quotations' - "
        "never ask for a quotation/enquiry number), unclear (need clarification). Budgets in INR "
        "(1 lakh=100000). "
        "Only extract what is clearly stated; do not invent."
    )
    try:
        return claude.structured(system, message, SupervisorDecision)
    except ClaudeUnavailable:
        return None


# ---------------- intent handlers ----------------


def _handle_vehicle_search(db: Session, decision: SupervisorDecision, message: str) -> StructuredChatResponse:
    prefs = decision.preferences
    req = CarFinderRequest(
        message=message,
        budget_max=prefs.budget_max,
        budget_min=prefs.budget_min,
        city=prefs.city,
        body_type=prefs.body_type,
        fuel_type=prefs.fuel_type,
        transmission=prefs.transmission,
        seating_capacity=prefs.seating_capacity,
    )
    finder = run_car_finder(db, req)
    vehicles = [r.model_dump() for r in finder.recommendations]
    actions: List[ChatAction] = []
    if len(vehicles) >= 2:
        actions.append(
            ChatAction(
                type="compare_vehicles",
                label="Compare these",
                payload={"vehicle_ids": [v["vehicle_id"] for v in vehicles[:3]]},
            )
        )
    if not vehicles:
        return StructuredChatResponse(
            intent=Intent.vehicle_search,
            message=finder.explanation,
            ai_generated=finder.ai_generated,
        )
    return StructuredChatResponse(
        intent=Intent.vehicle_search,
        message=finder.explanation,
        data=ChatData(vehicles=vehicles),
        actions=actions,
        ai_generated=finder.ai_generated,
    )


def _handle_comparison(db: Session, decision: SupervisorDecision, message: str) -> StructuredChatResponse:
    # Prefer robust DB-driven scan of the message; fall back to extracted names.
    ids = comparison.resolve_from_text(db, message)
    if len(ids) < 2 and decision.vehicle_names:
        ids = comparison.resolve_models(db, decision.vehicle_names)
    if len(ids) < 2:
        return StructuredChatResponse(
            intent=Intent.comparison,
            message=(
                "Tell me at least two models to compare (for example: 'Compare Tata Nexon and "
                "Hyundai Venue'). I could not confidently identify two models from that."
            ),
            clarification_required=True,
        )
    result, vehicles = comparison.build_comparison(db, ids, decision.preferences)
    actions = [
        ChatAction(type="request_quotes", label="Request dealer quotes", payload={"vehicle_id": v["vehicle_id"]})
        for v in vehicles[:1]
    ]
    return StructuredChatResponse(
        intent=Intent.comparison,
        message=result.recommendation or "Here is how these models compare.",
        data=ChatData(comparison=result, vehicles=vehicles),
        actions=actions,
        ai_generated=get_claude().available,
    )


def _match_manufacturer(db: Session, message: str) -> Optional[str]:
    from app.models import Manufacturer

    text = message.lower()
    for m in db.query(Manufacturer).filter(Manufacturer.active.is_(True)).all():
        # Match full name or first token (e.g. "Tata" for "Tata Motors").
        if m.name.lower() in text or m.name.split()[0].lower() in text:
            return m.name
    return None


def _handle_dealer_search(db: Session, decision: SupervisorDecision, message: str) -> StructuredChatResponse:
    city = decision.preferences.city
    if not city:
        # Try to pull a city after 'in'/'near'.
        m = re.search(r"(?:in|near|around)\s+([A-Z][a-zA-Z]+)", message)
        city = m.group(1) if m else None
    mfr = _match_manufacturer(db, message)
    dealers = tools.search_dealers(db, city=city, manufacturer_name=mfr, limit=12)
    if not dealers:
        return StructuredChatResponse(
            intent=Intent.dealer_search,
            message=(
                f"I could not find dealerships{' in ' + city if city else ''}"
                f"{' for ' + mfr if mfr else ''} in our directory. Try another city or brand."
            ),
        )
    where = f" in {city}" if city else ""
    return StructuredChatResponse(
        intent=Intent.dealer_search,
        message=f"Found {len(dealers)} dealership(s){where}.",
        data=ChatData(dealers=dealers),
    )


def _inr(amount: float) -> str:
    """Compact INR formatting (lakh) for conversational summaries."""
    if amount >= 100000:
        return f"Rs {amount / 100000:.2f} lakh"
    return f"Rs {amount:,.0f}"


def _handle_quote_review(db: Session, user: Optional[User], message: str) -> StructuredChatResponse:
    if not user:
        return StructuredChatResponse(
            intent=Intent.quote_review,
            message="Please log in to review your dealer quotations securely.",
            clarification_required=True,
        )

    # All of this customer's quotations (ownership enforced inside the tool).
    all_rows = tools.list_customer_quotations(db, user)
    if not all_rows:
        return StructuredChatResponse(
            intent=Intent.quote_review,
            message=(
                "You do not have any dealer quotations yet. Browse a car and use 'Request Dealer "
                "Quotes' to collect on-road offers, then I can compare them for you."
            ),
        )

    # 1) Did the customer name a specific car model? Resolve it from the message.
    model_ids = comparison.resolve_from_text(db, message)
    if model_ids:
        matched = [r for r in all_rows if r["model_id"] in set(model_ids)]
        if not matched:
            model_names = sorted({r["model"] for r in all_rows})
            return StructuredChatResponse(
                intent=Intent.quote_review,
                message=(
                    "You do not have quotations for that car yet. You currently have quotations for: "
                    + ", ".join(model_names)
                    + ". Which one would you like to compare?"
                ),
                clarification_required=True,
            )
        label = matched[0]["model"]
        lowest = min(matched, key=lambda r: r["final_price"])
        return StructuredChatResponse(
            intent=Intent.quote_review,
            message=(
                f"Comparing {len(matched)} quotation(s) for your {label}. "
                f"Lowest on-road price: {_inr(lowest['final_price'])} from {lowest['dealer']}. "
                "The lowest offer is highlighted; you decide which dealer suits you best."
            ),
            data=ChatData(quotations=matched),
        )

    # 2) Backward-compatible: an explicit enquiry number still works.
    m = re.search(r"#(\d+)|enquiry\s+(\d+)", message, flags=re.IGNORECASE)
    if m:
        enquiry_id = int(m.group(1) or m.group(2))
        quotations = tools.compare_quotations(db, user, enquiry_id)
        if not quotations:
            return StructuredChatResponse(
                intent=Intent.quote_review,
                message=f"No quotations found for enquiry #{enquiry_id} that you are authorized to view.",
            )
        return StructuredChatResponse(
            intent=Intent.quote_review,
            message=f"Comparing {len(quotations)} quotation(s) for enquiry #{enquiry_id}. The lowest valid final price is highlighted.",
            data=ChatData(quotations=quotations),
        )

    # 3) No car named: list what the customer has, grouped per car, and ask which.
    by_model: dict[str, List[dict]] = {}
    for r in all_rows:
        by_model.setdefault(r["model"], []).append(r)
    lines = []
    for model_name in sorted(by_model):
        group = by_model[model_name]
        low = min(group, key=lambda r: r["final_price"])
        lines.append(f"- {model_name}: {len(group)} quote(s), lowest {_inr(low['final_price'])} ({low['dealer']})")
    return StructuredChatResponse(
        intent=Intent.quote_review,
        message=(
            "Here are the cars you have dealer quotations for. Tell me a car name to compare its "
            "offers in detail:\n" + "\n".join(lines)
        ),
        data=ChatData(quotations=all_rows),
        clarification_required=True,
    )


def _handle_buying_advice(db: Session, user: Optional[User], decision: SupervisorDecision, message: str) -> StructuredChatResponse:
    # Pull candidate vehicles to ground the advice.
    ids = comparison.resolve_models(db, decision.vehicle_names) if decision.vehicle_names else []
    vehicle_id = ids[0] if ids else None
    if user:
        chat = run_buying_assistant(db, user, message, vehicle_id=vehicle_id)
        reply = chat.reply
        ai = chat.ai_generated
    else:
        # Guest: answer generally using catalogue search, no personal data.
        finder = run_car_finder(db, CarFinderRequest(message=message, budget_max=decision.preferences.budget_max))
        reply = finder.explanation
        ai = finder.ai_generated
    data = ChatData()
    if vehicle_id:
        details = tools.get_vehicle_details(db, vehicle_id)
        if details:
            data.vehicles = [details]
    return StructuredChatResponse(
        intent=Intent.buying_advice,
        message=reply,
        data=data,
        ai_generated=ai,
    )


def classify(message: str) -> SupervisorDecision:
    return _ai_decision(message) or _heuristic_decision(message)


def dispatch(db: Session, user: Optional[User], decision: SupervisorDecision, message: str) -> StructuredChatResponse:
    if decision.intent == Intent.vehicle_search:
        return _handle_vehicle_search(db, decision, message)
    if decision.intent == Intent.comparison:
        return _handle_comparison(db, decision, message)
    if decision.intent == Intent.dealer_search:
        return _handle_dealer_search(db, decision, message)
    if decision.intent == Intent.quote_review:
        return _handle_quote_review(db, user, message)
    if decision.intent == Intent.buying_advice:
        return _handle_buying_advice(db, user, decision, message)
    return StructuredChatResponse(
        intent=Intent.unclear,
        message=(
            "I can help you find cars, compare models, discover dealerships, review dealer "
            "quotations, or weigh buying options. What would you like to do? For example: "
            "'Find an automatic SUV under 15 lakh' or 'Compare Tata Nexon and Hyundai Venue'."
        ),
        clarification_required=True,
        actions=[
            ChatAction(type="suggest", label="Find an SUV under 15 lakh", payload={"message": "Find an SUV under 15 lakh"}),
            ChatAction(type="suggest", label="Compare Tata Nexon and Hyundai Venue", payload={"message": "Compare Tata Nexon and Hyundai Venue"}),
        ],
    )
