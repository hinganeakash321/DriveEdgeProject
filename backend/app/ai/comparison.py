"""Vehicle Comparison agent: compares 2+ models using verified catalogue data.

Resolves model names against the DB, pulls specs via tools, normalizes
attributes, and builds a structured comparison. Missing values are shown as
"Not available" (never invented). The recommendation is requirement-aware.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai import tools
from app.ai.claude_service import ClaudeUnavailable, get_claude
from app.ai.schemas import ComparisonResult, ComparisonRow, ExtractedPreferences
from app.models import Manufacturer, VehicleModel

_NA = "Not available"


def resolve_from_text(db: Session, text: str, limit: int = 4) -> List[int]:
    """Scan the message for known catalogue model names (robust, DB-driven)."""
    text_low = f" {text.lower()} "
    rows = (
        db.query(VehicleModel)
        .join(Manufacturer, VehicleModel.manufacturer_id == Manufacturer.id)
        .filter(VehicleModel.active.is_(True))
        .all()
    )
    hits = []
    for m in rows:
        model_low = m.model_name.lower()
        full_low = f"{m.manufacturer.name} {m.model_name}".lower()
        pos = -1
        if full_low in text_low:
            pos = text_low.index(full_low)
        elif len(model_low) > 2 and f" {model_low} " in text_low:
            pos = text_low.index(f" {model_low} ")
        if pos >= 0:
            hits.append((pos, m.id))
    hits.sort()
    ids: List[int] = []
    for _pos, mid in hits:
        if mid not in ids:
            ids.append(mid)
        if len(ids) >= limit:
            break
    return ids


def resolve_models(db: Session, names: List[str], limit: int = 4) -> List[int]:
    """Resolve free-text model names to vehicle_model ids (best-effort, de-duped)."""
    ids: List[int] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        q = (
            db.query(VehicleModel)
            .join(Manufacturer, VehicleModel.manufacturer_id == Manufacturer.id)
            .filter(VehicleModel.active.is_(True))
        )
        # Try matching "<brand> <model>" then just the model token.
        match = q.filter(
            func.lower(Manufacturer.name + " " + VehicleModel.model_name).like(f"%{name.lower()}%")
        ).first()
        if not match:
            match = q.filter(VehicleModel.model_name.ilike(f"%{name}%")).first()
        if match and match.id not in ids:
            ids.append(match.id)
        if len(ids) >= limit:
            break
    return ids


def _cheapest_variant(details: dict) -> Optional[dict]:
    variants = [v for v in details.get("variants", []) if v.get("price")]
    return min(variants, key=lambda v: v["price"]) if variants else None


def _spec(details: dict, key: str) -> str:
    v = _cheapest_variant(details)
    if not v:
        return _NA
    val = v.get(key)
    return str(val) if val not in (None, "") else _NA


def build_comparison(db: Session, vehicle_ids: List[int], prefs: Optional[ExtractedPreferences] = None) -> Tuple[ComparisonResult, List[dict]]:
    vehicles = tools.compare_vehicles(db, vehicle_ids)
    names = [f"{v.get('manufacturer') or ''} {v.get('model') or ''}".strip() for v in vehicles]

    def price_range(v: dict) -> str:
        lo, hi = v.get("min_price"), v.get("max_price")
        if lo is None:
            return _NA
        if hi and hi != lo:
            return f"Rs {lo:,.0f} - {hi:,.0f}"
        return f"Rs {lo:,.0f}"

    rows = [
        ComparisonRow(attribute="Body type", values=[v.get("body_type") or _NA for v in vehicles]),
        ComparisonRow(attribute="Price (ex-showroom)", values=[price_range(v) for v in vehicles]),
        ComparisonRow(attribute="Fuel (entry variant)", values=[_spec(v, "fuel_type") for v in vehicles]),
        ComparisonRow(attribute="Transmission (entry)", values=[_spec(v, "transmission") for v in vehicles]),
        ComparisonRow(attribute="Mileage (entry)", values=[_spec(v, "mileage") for v in vehicles]),
        ComparisonRow(attribute="Seating", values=[_spec(v, "seating") for v in vehicles]),
        ComparisonRow(attribute="Variants available", values=[str(len(v.get("variants", []))) for v in vehicles]),
    ]

    differences: List[str] = []
    prices = [(n, v.get("min_price")) for n, v in zip(names, vehicles) if v.get("min_price")]
    if len(prices) >= 2:
        cheapest = min(prices, key=lambda x: x[1])
        differences.append(f"{cheapest[0]} has the lowest starting price in this set.")

    result = ComparisonResult(vehicles=names, rows=rows, differences=differences)
    result.recommendation = _recommend(names, vehicles, prefs)
    return result, vehicles


def _recommend(names: List[str], vehicles: List[dict], prefs: Optional[ExtractedPreferences]) -> str:
    if len(vehicles) < 2:
        return "Select at least two vehicles to compare."
    claude = get_claude()
    if claude.available:
        facts = []
        for n, v in zip(names, vehicles):
            facts.append(
                f"- {n}: body {v.get('body_type')}, from Rs {v.get('min_price')}, "
                f"variants {len(v.get('variants', []))}"
            )
        system = (
            "You are DriveEdge's comparison expert for the Indian car market. Using ONLY the facts "
            "provided, give a concise, balanced recommendation tailored to the user's stated needs. "
            "Never invent specs or prices. If a requirement cannot be verified from the facts, say so."
        )
        pref_text = prefs.model_dump_json() if prefs else "{}"
        user = f"User needs: {pref_text}\nVehicles:\n" + "\n".join(facts) + "\n\nWhich fits best and why?"
        try:
            return claude.invoke(system, user)
        except ClaudeUnavailable:
            pass
    # Deterministic fallback: pick lowest-price within budget if any.
    priced = [(n, v.get("min_price")) for n, v in zip(names, vehicles) if v.get("min_price")]
    if priced:
        best = min(priced, key=lambda x: x[1])
        return (
            f"On starting price, {best[0]} is the most affordable here. Review the attribute table for "
            "trade-offs in body type, transmission and features before deciding."
        )
    return "Review the attribute table above; price data is limited for these models."
