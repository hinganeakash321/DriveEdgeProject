"""Admin conversational agent.

Administrator-only. Operates purely on platform-wide aggregates - no individual
customer PII is ever sent to the model. Claude only narrates already-computed
aggregate facts; a deterministic fallback is used when Claude is unavailable.
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.ai.admin_insights import _metrics, run_admin_insights
from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.ai.schemas import AdminIntent, StructuredChatResponse

_INSIGHT_KW = ("insight", "summary", "overview", "health", "how is the platform", "performance", "report", "metrics")
_LOOKUP_KW = ("how many", "count", "number of", "total", "pending", "verified", "top ")


def classify(message: str) -> AdminIntent:
    decision = _ai_classify(message)
    if decision is not None:
        return decision
    return _heuristic_classify(message)


def _heuristic_classify(message: str) -> AdminIntent:
    text = message.lower()
    if any(k in text for k in _LOOKUP_KW):
        return AdminIntent.lookup
    if any(k in text for k in _INSIGHT_KW):
        return AdminIntent.insights
    return AdminIntent.general


def _ai_classify(message: str) -> Optional[AdminIntent]:
    claude = get_claude()
    if not claude.available:
        return None

    from pydantic import BaseModel

    class _Decision(BaseModel):
        intent: AdminIntent = AdminIntent.general

    system = (
        "You route a marketplace administrator's message for the DriveEdge admin assistant. "
        "Intents: insights (executive summary / platform health / recommendations), lookup "
        "(a specific aggregate number, e.g. how many dealers are pending), general. Pick one."
    )
    try:
        return claude.structured(system, message, _Decision).intent
    except ClaudeUnavailable:
        return None


def _handle_insights(db: Session, message: str) -> StructuredChatResponse:
    result = run_admin_insights(db, message=message)
    return StructuredChatResponse(
        intent=AdminIntent.insights.value,
        message=result["summary"],
        ai_generated=result["ai_generated"],
    )


def _handle_lookup(db: Session, message: str) -> StructuredChatResponse:
    m = _metrics(db)
    claude = get_claude()
    if claude.available:
        system = (
            "You answer a DriveEdge administrator's question using ONLY the supplied platform-wide "
            "aggregate metrics. No personal customer data is available. If the answer is not in the "
            "metrics, say so. Answer in one or two sentences with the relevant number."
        )
        try:
            reply = claude.invoke(system, f"Aggregate metrics: {m}. Question: {message}")
            return StructuredChatResponse(
                intent=AdminIntent.lookup.value, message=reply.strip(), ai_generated=True
            )
        except ClaudeUnavailable:
            pass
    # Deterministic fallback: hand back the aggregate line.
    summary = (
        f"Customers: {m['total_customers']}, Dealers: {m['total_dealers']} "
        f"({m['verified_dealers']} verified, {m['pending_dealer_approvals']} pending), "
        f"Active models: {m['active_models']}, Enquiries: {m['total_enquiries']}, "
        f"Submitted quotations: {m['quotations_submitted']}."
    )
    return StructuredChatResponse(intent=AdminIntent.lookup.value, message=summary, ai_generated=False)


def _handle_general(db: Session, message: str) -> StructuredChatResponse:
    m = _metrics(db)
    claude = get_claude()
    if claude.available:
        system = (
            "You are the DriveEdge admin assistant. Help the administrator understand the platform "
            "using ONLY the supplied aggregate metrics. Never reference or invent individual "
            "customer data. Be concise."
        )
        try:
            reply = claude.invoke(system, f"Aggregate metrics: {m}. Question: {message}")
            return StructuredChatResponse(
                intent=AdminIntent.general.value, message=reply.strip(), ai_generated=True
            )
        except ClaudeUnavailable:
            pass
    return StructuredChatResponse(
        intent=AdminIntent.general.value,
        message=(
            "I can summarise platform health, surface pending dealer approvals, and answer "
            "aggregate questions about customers, dealers, models, enquiries and quotations. "
            "What would you like to know?"
        ),
    )


def dispatch(db: Session, intent: AdminIntent, message: str) -> StructuredChatResponse:
    if intent == AdminIntent.insights:
        return _handle_insights(db, message)
    if intent == AdminIntent.lookup:
        return _handle_lookup(db, message)
    return _handle_general(db, message)


def run_admin_chat(
    db: Session, message: str, history: Optional[List[dict]] = None
) -> StructuredChatResponse:
    try:
        intent = classify(message)
        return dispatch(db, intent, message)
    except Exception as exc:  # pragma: no cover - defensive
        return StructuredChatResponse(
            intent=AdminIntent.general.value,
            message="Something went wrong handling that. Please try rephrasing.",
            error=str(exc),
        )
