"""AI Car Finder: LangGraph workflow with deterministic guardrails.

Flow: validate -> extract preferences (Claude or heuristic) -> deterministic
backend filtering (hard constraints enforced in Python) -> transparent ranking
-> explanation (Claude or template). Only vehicles returned by backend tools are
ever recommended.
"""
from __future__ import annotations

import re
from typing import List, Optional

from sqlalchemy.orm import Session

from app.ai import tools
from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.ai.schemas import (
    CarFinderRequest,
    CarFinderResponse,
    ExtractedPreferences,
    Recommendation,
)
from app.schemas.common import DISCLAIMER

_BODY_KEYWORDS = {
    "suv": "SUV",
    "hatchback": "Hatchback",
    "sedan": "Sedan",
    "muv": "MUV",
    "mpv": "MUV",
}
_FUEL_KEYWORDS = ["petrol", "diesel", "cng", "electric", "hybrid"]


def _heuristic_extract(req: CarFinderRequest) -> ExtractedPreferences:
    text = req.message.lower()
    prefs = ExtractedPreferences(
        budget_max=req.budget_max,
        budget_min=req.budget_min,
        body_type=req.body_type,
        fuel_type=req.fuel_type,
        transmission=req.transmission,
        seating_capacity=req.seating_capacity,
        city=req.city,
    )
    # Budget like "under 12 lakh" / "15 lakh"
    if prefs.budget_max is None:
        m = re.search(r"(\d+(?:\.\d+)?)\s*lakh", text)
        if m:
            prefs.budget_max = float(m.group(1)) * 100000
    if prefs.body_type is None:
        for kw, val in _BODY_KEYWORDS.items():
            if kw in text:
                prefs.body_type = val
                break
    if prefs.fuel_type is None:
        for f in _FUEL_KEYWORDS:
            if f in text:
                prefs.fuel_type = f
                break
    if prefs.transmission is None:
        if "automatic" in text or "amt" in text:
            prefs.transmission = "automatic"
        elif "manual" in text:
            prefs.transmission = "manual"
    if prefs.seating_capacity is None:
        m = re.search(r"(\d+)\s*seat", text)
        if m:
            prefs.seating_capacity = int(m.group(1))
        elif "family" in text:
            prefs.seating_capacity = 5
    return prefs


def _ai_extract(req: CarFinderRequest) -> Optional[ExtractedPreferences]:
    claude = get_claude()
    if not claude.available:
        return None
    system = (
        "You extract structured car-buying preferences from a user's message for the Indian "
        "market. Return budgets in INR (1 lakh = 100000). Only fill fields you are confident "
        "about; leave others null. Do not invent preferences."
    )
    try:
        return claude.structured(system, req.message, ExtractedPreferences)
    except ClaudeUnavailable:
        return None


def _rank(vehicles: List[dict], prefs: ExtractedPreferences) -> List[dict]:
    """Transparent scoring: closeness to budget + preference matches."""
    def score(v: dict) -> float:
        s = 0.0
        price = v.get("min_price")
        if prefs.budget_max and price:
            if price <= prefs.budget_max:
                s += 50 - (prefs.budget_max - price) / max(prefs.budget_max, 1) * 10
            else:
                s -= 100  # should already be filtered; safety
        if prefs.fuel_type and prefs.fuel_type in (v.get("fuel_types") or []):
            s += 20
        if prefs.transmission:
            trans = v.get("transmissions") or []
            if prefs.transmission == "automatic" and any(
                t in trans for t in ["automatic", "amt", "cvt", "dct"]
            ):
                s += 15
            elif prefs.transmission in trans:
                s += 15
        if prefs.seating_capacity and prefs.seating_capacity in (v.get("seating") or []):
            s += 15
        return s

    return sorted(vehicles, key=score, reverse=True)


def _build_recommendations(vehicles: List[dict], prefs: ExtractedPreferences) -> List[Recommendation]:
    recs = []
    for v in vehicles[:5]:
        matches, tradeoffs, unknowns = [], [], []
        if prefs.budget_max and v.get("min_price"):
            if v["min_price"] <= prefs.budget_max:
                matches.append(f"Starts within your budget at ₹{v['min_price']:,.0f}")
            else:
                tradeoffs.append("Starting price is above your budget")
        if prefs.fuel_type:
            if prefs.fuel_type in (v.get("fuel_types") or []):
                matches.append(f"Available in {prefs.fuel_type}")
            else:
                tradeoffs.append(f"Not offered in {prefs.fuel_type}")
        if prefs.body_type:
            matches.append(f"{v.get('body_type')} body type")
        if not v.get("min_price"):
            unknowns.append("Price not yet available")
        recs.append(
            Recommendation(
                vehicle_id=v["vehicle_id"],
                manufacturer=v.get("manufacturer"),
                model=v.get("model"),
                min_price=v.get("min_price"),
                max_price=v.get("max_price"),
                matches=matches,
                tradeoffs=tradeoffs,
                unknowns=unknowns,
            )
        )
    return recs


def _explain(prefs: ExtractedPreferences, recs: List[Recommendation]) -> tuple[str, bool]:
    claude = get_claude()
    if not recs:
        return (
            "No vehicles in our catalogue currently match all your hard constraints. "
            "Try widening your budget or relaxing fuel/transmission preferences.",
            False,
        )
    if claude.available:
        facts = "\n".join(
            f"- {r.manufacturer} {r.model}: from ₹{r.min_price:,.0f}" if r.min_price else f"- {r.manufacturer} {r.model}"
            for r in recs
        )
        system = (
            "You are DriveEdge's car-buying assistant for India. Explain the shortlist using "
            "ONLY the facts provided. Never invent prices, specs, or models. Be concise, friendly, "
            "and mention trade-offs honestly."
        )
        user = f"User preferences: {prefs.model_dump_json()}\nShortlist:\n{facts}\n\nExplain the recommendations."
        try:
            return claude.invoke(system, user), True
        except ClaudeUnavailable:
            pass
    top = ", ".join(f"{r.manufacturer} {r.model}" for r in recs)
    return (
        f"Based on your preferences, these models look like a good fit: {top}. "
        "Each is drawn from our live catalogue. Review the trade-offs listed for each.",
        False,
    )


def run_car_finder(db: Session, req: CarFinderRequest) -> CarFinderResponse:
    # 1-3. Extract preferences (Claude, else heuristic).
    prefs = _ai_extract(req) or _heuristic_extract(req)
    # Merge explicit request fields over extracted (explicit wins).
    for field in ["budget_max", "budget_min", "body_type", "fuel_type", "transmission", "seating_capacity", "city"]:
        val = getattr(req, field)
        if val is not None:
            setattr(prefs, field, val)

    # 4-8. Deterministic backend filtering (hard constraints enforced here).
    vehicles = tools.search_vehicles(
        db,
        min_price=prefs.budget_min,
        max_price=prefs.budget_max,
        body_type=prefs.body_type,
        fuel_type=prefs.fuel_type,
        transmission=prefs.transmission,
        seating_capacity=prefs.seating_capacity,
        limit=15,
    )
    # 9. Rank.
    ranked = _rank(vehicles, prefs)
    recs = _build_recommendations(ranked, prefs)
    # 10-12. Explain + return.
    explanation, ai_generated = _explain(prefs, recs)
    return CarFinderResponse(
        preferences=prefs,
        recommendations=recs,
        explanation=explanation,
        ai_generated=ai_generated,
        disclaimer=DISCLAIMER,
    )
