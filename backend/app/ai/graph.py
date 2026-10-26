"""LangGraph orchestration for the DriveEdge supervisor workflow.

Graph: START -> load_context -> classify -> dispatch -> END. The graph provides
controlled orchestration (typed state, recursion limit); all reasoning delegates
to supervisor handlers, and every tool call enforces authorization deterministically.
If LangGraph is unavailable for any reason, run_chat falls back to a direct call.
"""
from __future__ import annotations

import logging
from typing import Any, List, Optional

from typing_extensions import TypedDict

from sqlalchemy.orm import Session

from app.ai import supervisor
from app.ai.schemas import Intent, StructuredChatResponse, SupervisorDecision
from app.core.config import settings
from app.models import User

logger = logging.getLogger("driveedge.ai.graph")


class AgentState(TypedDict, total=False):
    db: Any
    user: Optional[User]
    user_message: str
    history: List[dict]
    decision: SupervisorDecision
    response: StructuredChatResponse
    error: Optional[str]


def _merge_memory(decision: SupervisorDecision, history: List[dict]) -> SupervisorDecision:
    """Carry forward preferences from earlier user turns the user hasn't overridden."""
    from app.ai.car_finder import _heuristic_extract
    from app.ai.schemas import CarFinderRequest

    prior_text = " ".join(
        t.get("content", "") for t in (history or []) if t.get("role") == "user"
    ).strip()
    if not prior_text:
        return decision
    try:
        prior = _heuristic_extract(CarFinderRequest(message=prior_text))
    except Exception:
        return decision
    for field in ["budget_max", "budget_min", "body_type", "fuel_type", "transmission", "seating_capacity", "city"]:
        if getattr(decision.preferences, field) is None and getattr(prior, field) is not None:
            setattr(decision.preferences, field, getattr(prior, field))
    return decision


def _load_context(state: AgentState) -> AgentState:
    state.setdefault("history", [])
    return state


def _classify(state: AgentState) -> AgentState:
    try:
        decision = supervisor.classify(state["user_message"])
        decision = _merge_memory(decision, state.get("history", []))
        state["decision"] = decision
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("classify failed: %s", exc)
        state["decision"] = SupervisorDecision(intent=Intent.unclear)
        state["error"] = str(exc)
    return state


def _dispatch(state: AgentState) -> AgentState:
    try:
        state["response"] = supervisor.dispatch(
            state["db"], state.get("user"), state["decision"], state["user_message"]
        )
    except Exception as exc:
        logger.warning("dispatch failed: %s", exc)
        state["response"] = StructuredChatResponse(
            intent=state["decision"].intent if state.get("decision") else Intent.unclear,
            message="Something went wrong while handling that request. Please try rephrasing.",
            error=str(exc),
        )
    return state


def _build_graph():
    from langgraph.graph import END, START, StateGraph

    g = StateGraph(AgentState)
    g.add_node("load_context", _load_context)
    g.add_node("classify", _classify)
    g.add_node("dispatch", _dispatch)
    g.add_edge(START, "load_context")
    g.add_edge("load_context", "classify")
    g.add_edge("classify", "dispatch")
    g.add_edge("dispatch", END)
    return g.compile()


_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph


def run_chat(
    db: Session,
    user: Optional[User],
    message: str,
    history: Optional[List[dict]] = None,
) -> StructuredChatResponse:
    state: AgentState = {
        "db": db,
        "user": user,
        "user_message": message,
        "history": history or [],
    }
    try:
        result = _get_graph().invoke(state, config={"recursion_limit": settings.ai_recursion_limit})
        return result["response"]
    except Exception as exc:  # LangGraph unavailable/failure -> direct fallback
        logger.warning("graph invoke failed, using direct path: %s", exc)
        decision = supervisor.classify(message)
        decision = _merge_memory(decision, history or [])
        return supervisor.dispatch(db, user, decision, message)
