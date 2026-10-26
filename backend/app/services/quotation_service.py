"""Quotation monetary calculations and status transitions (backend-authoritative)."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, List

from app.models import Quotation
from app.models.enums import QuotationStatus

TWO_PLACES = Decimal("0.01")

# Allowed status transitions enforced on the backend.
_ALLOWED_TRANSITIONS = {
    QuotationStatus.DRAFT: {QuotationStatus.SUBMITTED, QuotationStatus.CANCELLED},
    QuotationStatus.SUBMITTED: {
        QuotationStatus.PREFERRED,
        QuotationStatus.ACCEPTED,
        QuotationStatus.REJECTED,
        QuotationStatus.EXPIRED,
        QuotationStatus.CANCELLED,
    },
    QuotationStatus.PREFERRED: {
        QuotationStatus.ACCEPTED,
        QuotationStatus.REJECTED,
        QuotationStatus.EXPIRED,
        QuotationStatus.SUBMITTED,
    },
    QuotationStatus.ACCEPTED: set(),
    QuotationStatus.REJECTED: set(),
    QuotationStatus.EXPIRED: set(),
    QuotationStatus.CANCELLED: set(),
}


def can_transition(current: QuotationStatus, target: QuotationStatus) -> bool:
    if current == target:
        return True
    return target in _ALLOWED_TRANSITIONS.get(current, set())


def _d(value) -> Decimal:
    return Decimal(str(value or 0))


def compute_final_price(
    ex_showroom_price,
    registration_charges,
    insurance_amount,
    accessories_amount,
    discount_amount,
    other_charges,
) -> Decimal:
    """Final = ex-showroom + registration + insurance + accessories + other - discount."""
    total = (
        _d(ex_showroom_price)
        + _d(registration_charges)
        + _d(insurance_amount)
        + _d(accessories_amount)
        + _d(other_charges)
        - _d(discount_amount)
    )
    if total < 0:
        total = Decimal(0)
    return total.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def recompute(quotation: Quotation) -> Quotation:
    quotation.final_price = compute_final_price(
        quotation.ex_showroom_price,
        quotation.registration_charges,
        quotation.insurance_amount,
        quotation.accessories_amount,
        quotation.discount_amount,
        quotation.other_charges,
    )
    return quotation


def value_score(q: Quotation, lowest_final: Decimal) -> float:
    """Transparent 0-100 score weighting price primarily, lightly rewarding validity.

    This is an assistive heuristic, NOT an automatic 'best offer' verdict.
    """
    final = _d(q.final_price)
    if final <= 0:
        return 0.0
    price_ratio = float(_d(lowest_final) / final) if final else 0.0  # 1.0 for cheapest
    score = price_ratio * 90.0
    if q.validity_date:
        score += 5.0
    if q.estimated_delivery:
        score += 5.0
    return round(min(score, 100.0), 1)


def annotate_comparison(quotations: List[Quotation]):
    """Return list of (quotation, is_lowest, value_score) for comparable quotations."""
    valid = [q for q in quotations if q.status in {QuotationStatus.SUBMITTED, QuotationStatus.PREFERRED}]
    if not valid:
        return [(q, False, None) for q in quotations]
    lowest = min(_d(q.final_price) for q in valid)
    result = []
    for q in quotations:
        is_lowest = q in valid and _d(q.final_price) == lowest
        score = value_score(q, lowest) if q in valid else None
        result.append((q, is_lowest, score))
    return result
