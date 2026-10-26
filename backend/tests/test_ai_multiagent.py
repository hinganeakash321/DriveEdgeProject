"""Multi-agent supervisor routing, comparison, and tool guardrails (Claude unconfigured)."""
import pytest

from app.ai import comparison, supervisor, tools
from app.ai.schemas import Intent
from app.models import (
    Dealer,
    DealerManufacturer,
    Manufacturer,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import FuelType, Transmission, VerificationStatus


@pytest.fixture()
def catalogue(db_session):
    tata = Manufacturer(name="Tata Motors", slug="tata", active=True)
    hyundai = Manufacturer(name="Hyundai", slug="hyundai", active=True)
    db_session.add_all([tata, hyundai])
    db_session.flush()

    nexon = VehicleModel(manufacturer_id=tata.id, model_name="Nexon", slug="tata-nexon", body_type="SUV", active=True)
    venue = VehicleModel(manufacturer_id=hyundai.id, model_name="Venue", slug="hyundai-venue", body_type="SUV", active=True)
    db_session.add_all([nexon, venue])
    db_session.flush()
    db_session.add_all([
        VehicleVariant(vehicle_model_id=nexon.id, variant_name="XM", fuel_type=FuelType.PETROL,
                       transmission=Transmission.MANUAL, ex_showroom_price=900000, seating_capacity=5, active=True),
        VehicleVariant(vehicle_model_id=venue.id, variant_name="S", fuel_type=FuelType.PETROL,
                       transmission=Transmission.MANUAL, ex_showroom_price=1000000, seating_capacity=5, active=True),
    ])

    dealer = Dealer(dealer_name="Pune Tata Motors", city="Pune", latitude=18.52, longitude=73.85,
                    verification_status=VerificationStatus.VERIFIED)
    db_session.add(dealer)
    db_session.flush()
    db_session.add(DealerManufacturer(dealer_id=dealer.id, manufacturer_id=tata.id))
    db_session.commit()
    return {"tata": tata, "nexon": nexon, "venue": venue, "dealer": dealer}


# ---- Intent routing (deterministic heuristic since Claude is unconfigured) ----

@pytest.mark.parametrize(
    "message,expected",
    [
        ("Find an automatic SUV under 15 lakh", Intent.vehicle_search),
        ("Compare Tata Nexon and Hyundai Venue", Intent.comparison),
        ("Find Tata dealerships in Pune", Intent.dealer_search),
        ("Compare dealer quotations for enquiry 1", Intent.quote_review),
        ("Should I buy petrol or diesel?", Intent.buying_advice),
    ],
)
def test_heuristic_intent_routing(message, expected):
    decision = supervisor._heuristic_decision(message)
    assert decision.intent == expected


def test_short_message_does_not_crash_dispatch(db_session, catalogue):
    """A very short query routed to vehicle_search must not raise a validation error."""
    from app.ai.graph import run_chat

    r = run_chat(db_session, None, "ev", history=[])
    assert r.error is None  # dispatch completed without an internal exception


def test_extracted_preferences_drop_invalid_enums():
    """Hallucinated values like '<UNKNOWN>' must not propagate into filters."""
    from app.ai.schemas import ExtractedPreferences

    p = ExtractedPreferences(fuel_type="<UNKNOWN>", transmission="AUTOMATIC", body_type="SUV")
    assert p.fuel_type is None
    assert p.transmission == "automatic"  # normalized, still valid
    assert p.body_type == "SUV"


def test_comparison_resolves_models_from_text(db_session, catalogue):
    ids = comparison.resolve_from_text(db_session, "Compare Tata Nexon and Hyundai Venue")
    assert set(ids) == {catalogue["nexon"].id, catalogue["venue"].id}


def test_build_comparison_only_real_vehicles(db_session, catalogue):
    ids = [catalogue["nexon"].id, catalogue["venue"].id]
    result, vehicles = comparison.build_comparison(db_session, ids, None)
    returned = {v["vehicle_id"] for v in vehicles}
    assert returned == set(ids)
    assert result.rows  # has comparison rows


def test_dealer_search_tool_scopes_by_city_and_brand(db_session, catalogue):
    res = tools.search_dealers(db_session, city="Pune", manufacturer_name="Tata Motors", limit=10)
    assert len(res) == 1
    assert res[0]["city"] == "Pune"
    # A city with no dealers returns nothing.
    assert tools.search_dealers(db_session, city="Chennai", limit=10) == []


# ---- Tool guardrails ----

def test_running_cost_requires_inputs_not_invented():
    out = tools.calculate_running_cost(fuel_type="petrol")
    # Without distance/mileage the tool asks for inputs rather than fabricating a number.
    assert out.get("status") == "insufficient_inputs"


def test_compare_quotations_enforces_ownership(db_session, catalogue):
    """A customer can never see quotations belonging to another customer's enquiry."""
    from app.core.security import hash_password
    from app.models import CustomerEnquiry, User
    from app.models.enums import AccountStatus, UserRole

    owner = User(name="Owner", email="owner@example.com", password_hash=hash_password("x"),
                 role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    intruder = User(name="Intruder", email="intruder@example.com", password_hash=hash_password("x"),
                    role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    db_session.add_all([owner, intruder])
    db_session.flush()
    enquiry = CustomerEnquiry(customer_id=owner.id)
    db_session.add(enquiry)
    db_session.commit()

    # Intruder gets nothing for an enquiry they do not own.
    assert tools.compare_quotations(db_session, intruder, enquiry.id) == []


def _make_quote_for(db_session, customer, variant, dealer, final_price, status=None):
    """Helper: create an enquiry -> enquiry_dealer -> submitted quotation chain."""
    from decimal import Decimal

    from app.models import CustomerEnquiry, EnquiryDealer, Quotation
    from app.models.enums import QuotationStatus

    enquiry = CustomerEnquiry(customer_id=customer.id, vehicle_variant_id=variant.id)
    db_session.add(enquiry)
    db_session.flush()
    link = EnquiryDealer(enquiry_id=enquiry.id, dealer_id=dealer.id, response_status="responded")
    db_session.add(link)
    db_session.flush()
    q = Quotation(
        enquiry_dealer_id=link.id,
        dealer_id=dealer.id,
        vehicle_variant_id=variant.id,
        ex_showroom_price=Decimal(str(final_price)),
        final_price=Decimal(str(final_price)),
        status=status or QuotationStatus.SUBMITTED,
    )
    db_session.add(q)
    db_session.commit()
    return enquiry


def test_list_customer_quotations_grouped_and_ownership(db_session, catalogue):
    """list_customer_quotations is ownership-scoped, groups by model and flags lowest."""
    from app.core.security import hash_password
    from app.models import Dealer, DealerManufacturer, User
    from app.models.enums import AccountStatus, UserRole, VerificationStatus

    owner = User(name="Owner", email="o2@example.com", password_hash=hash_password("x"),
                 role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    intruder = User(name="Intruder", email="i2@example.com", password_hash=hash_password("x"),
                    role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    db_session.add_all([owner, intruder])
    db_session.flush()

    nexon_variant = db_session.query(VehicleVariant).filter(
        VehicleVariant.vehicle_model_id == catalogue["nexon"].id
    ).first()

    d2 = Dealer(dealer_name="Second Tata Motors", city="Mumbai", latitude=19.0, longitude=72.8,
                verification_status=VerificationStatus.VERIFIED)
    db_session.add(d2)
    db_session.flush()
    db_session.add(DealerManufacturer(dealer_id=d2.id, manufacturer_id=catalogue["tata"].id))
    db_session.commit()

    _make_quote_for(db_session, owner, nexon_variant, catalogue["dealer"], 1050000)
    _make_quote_for(db_session, owner, nexon_variant, d2, 990000)

    rows = tools.list_customer_quotations(db_session, owner)
    assert len(rows) == 2
    assert all("Nexon" in r["model"] for r in rows)
    lowest = [r for r in rows if r["is_lowest"]]
    assert len(lowest) == 1 and lowest[0]["final_price"] == 990000

    # Filter by model name works.
    assert len(tools.list_customer_quotations(db_session, owner, model_query="Nexon")) == 2
    assert tools.list_customer_quotations(db_session, owner, model_query="Venue") == []

    # Ownership: another customer sees nothing.
    assert tools.list_customer_quotations(db_session, intruder) == []


def test_quote_review_lists_by_car_not_number(db_session, catalogue):
    """Supervisor answers 'compare my quotations' without demanding a number."""
    from app.core.security import hash_password
    from app.models import User
    from app.models.enums import AccountStatus, UserRole

    customer = User(name="QR", email="qr@example.com", password_hash=hash_password("x"),
                    role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    db_session.add(customer)
    db_session.flush()
    nexon_variant = db_session.query(VehicleVariant).filter(
        VehicleVariant.vehicle_model_id == catalogue["nexon"].id
    ).first()
    _make_quote_for(db_session, customer, nexon_variant, catalogue["dealer"], 1050000)

    # No number given -> lists quotations grouped per car (never asks for a number).
    resp = supervisor._handle_quote_review(db_session, customer, "compare my dealer quotations")
    assert "number" not in resp.message.lower()
    assert resp.data.quotations and any("Nexon" in q["model"] for q in resp.data.quotations)

    # Naming the car returns that car's quotations.
    resp2 = supervisor._handle_quote_review(db_session, customer, "show quotations for Tata Nexon")
    assert resp2.data.quotations and all("Nexon" in q["model"] for q in resp2.data.quotations)


def test_fan_out_only_reaches_same_brand_dealers(db_session, catalogue):
    """Enquiry fan-out skips dealers that do not sell the car's brand."""
    from app.api.enquiries import _fan_out
    from app.core.security import hash_password
    from app.models import CustomerEnquiry, Dealer, DealerManufacturer, EnquiryDealer, User
    from app.models.enums import AccountStatus, UserRole, VerificationStatus

    customer = User(name="FO", email="fo@example.com", password_hash=hash_password("x"),
                    role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    db_session.add(customer)
    db_session.flush()

    hyundai_dealer = Dealer(dealer_name="Hyundai Showroom", city="Pune", latitude=18.5, longitude=73.8,
                            verification_status=VerificationStatus.VERIFIED)
    db_session.add(hyundai_dealer)
    db_session.flush()
    db_session.add(DealerManufacturer(dealer_id=hyundai_dealer.id,
                                      manufacturer_id=catalogue["venue"].manufacturer_id))
    db_session.flush()

    nexon_variant = db_session.query(VehicleVariant).filter(
        VehicleVariant.vehicle_model_id == catalogue["nexon"].id
    ).first()
    enquiry = CustomerEnquiry(customer_id=customer.id, vehicle_variant_id=nexon_variant.id)
    db_session.add(enquiry)
    db_session.flush()

    # Ask to fan out to BOTH a Tata dealer and a Hyundai dealer for a Tata car.
    created = _fan_out(db_session, enquiry, [catalogue["dealer"].id, hyundai_dealer.id], customer)
    db_session.commit()
    assert created == 1  # only the Tata dealer received it
    reached = {l.dealer_id for l in db_session.query(EnquiryDealer).filter(
        EnquiryDealer.enquiry_id == enquiry.id).all()}
    assert reached == {catalogue["dealer"].id}


def test_create_enquiry_requires_confirmation(db_session, catalogue):
    from app.core.security import hash_password
    from app.models import User
    from app.models.enums import AccountStatus, UserRole

    customer = User(name="Cust", email="z@example.com", password_hash=hash_password("x"),
                    role=UserRole.CUSTOMER, status=AccountStatus.ACTIVE)
    db_session.add(customer)
    db_session.flush()
    variant = db_session.query(VehicleVariant).first()

    out = tools.create_vehicle_enquiry(
        db_session, customer, vehicle_variant_id=variant.id, dealer_ids=[catalogue["dealer"].id], confirm=False
    )
    assert out.get("status") == "confirmation_required"
    # Nothing was persisted without confirmation.
    from app.models import CustomerEnquiry
    assert db_session.query(CustomerEnquiry).count() == 0
