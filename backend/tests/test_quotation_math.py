"""Unit tests for backend-authoritative quotation calculations."""
from decimal import Decimal

from app.models.enums import QuotationStatus
from app.services.quotation_service import can_transition, compute_final_price


def test_final_price_sums_components_and_subtracts_discount():
    result = compute_final_price(
        ex_showroom_price=1000000,
        registration_charges=80000,
        insurance_amount=40000,
        accessories_amount=20000,
        discount_amount=30000,
        other_charges=10000,
    )
    # 1000000 + 80000 + 40000 + 20000 + 10000 - 30000 = 1120000
    assert result == Decimal("1120000.00")


def test_final_price_never_negative():
    assert compute_final_price(100, 0, 0, 0, 1000, 0) == Decimal("0.00")


def test_final_price_handles_none_as_zero():
    assert compute_final_price(500000, None, None, None, None, None) == Decimal("500000.00")


def test_decimal_rounding_half_up():
    assert compute_final_price(Decimal("100.005"), 0, 0, 0, 0, 0) == Decimal("100.01")


def test_status_transitions():
    assert can_transition(QuotationStatus.DRAFT, QuotationStatus.SUBMITTED)
    assert can_transition(QuotationStatus.SUBMITTED, QuotationStatus.PREFERRED)
    assert not can_transition(QuotationStatus.DRAFT, QuotationStatus.PREFERRED)
    assert not can_transition(QuotationStatus.ACCEPTED, QuotationStatus.SUBMITTED)
