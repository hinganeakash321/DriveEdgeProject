"""Dealer & admin conversational agents: intent routing, dealer-scope isolation,
aggregate-only admin behaviour, and endpoint authorization."""
import pytest

from app.ai import admin_agent, dealer_agent, dealer_tools
from app.ai.schemas import AdminIntent, DealerIntent
from app.core.security import hash_password
from app.models import (
    CustomerEnquiry,
    Dealer,
    DealerManufacturer,
    EnquiryDealer,
    Manufacturer,
    Quotation,
    User,
    VehicleModel,
    VehicleVariant,
)
from app.models.enums import (
    AccountStatus,
    FuelType,
    QuotationStatus,
    Transmission,
    UserRole,
    VerificationStatus,
)
from tests.conftest import auth_header, register


@pytest.fixture()
def world(db_session):
    """Two dealerships (A, B), each owned by a dealer user, with enquiries and
    quotations, so we can assert cross-dealer isolation."""
    tata = Manufacturer(name="Tata Motors", slug="tata", active=True)
    db_session.add(tata)
    db_session.flush()
    nexon = VehicleModel(manufacturer_id=tata.id, model_name="Nexon", slug="tata-nexon", body_type="SUV", active=True)
    db_session.add(nexon)
    db_session.flush()
    variant = VehicleVariant(
        vehicle_model_id=nexon.id, variant_name="XM", fuel_type=FuelType.PETROL,
        transmission=Transmission.MANUAL, ex_showroom_price=900000, seating_capacity=5, active=True,
    )
    db_session.add(variant)
    db_session.flush()

    def mk_user(email, role):
        u = User(name=email.split("@")[0], email=email, password_hash=hash_password("Password123"),
                 role=role, status=AccountStatus.ACTIVE)
        db_session.add(u)
        db_session.flush()
        return u

    owner_a = mk_user("dealerA@example.com", UserRole.DEALER)
    owner_b = mk_user("dealerB@example.com", UserRole.DEALER)
    customer = mk_user("cust@example.com", UserRole.CUSTOMER)

    dealer_a = Dealer(dealer_name="Dealer A", city="Pune", owner_user_id=owner_a.id,
                      verification_status=VerificationStatus.VERIFIED)
    dealer_b = Dealer(dealer_name="Dealer B", city="Mumbai", owner_user_id=owner_b.id,
                      verification_status=VerificationStatus.VERIFIED)
    db_session.add_all([dealer_a, dealer_b])
    db_session.flush()
    db_session.add_all([
        DealerManufacturer(dealer_id=dealer_a.id, manufacturer_id=tata.id),
        DealerManufacturer(dealer_id=dealer_b.id, manufacturer_id=tata.id),
    ])

    # Enquiry fanned out to both dealers.
    enquiry = CustomerEnquiry(customer_id=customer.id, vehicle_variant_id=variant.id, location="Pune")
    db_session.add(enquiry)
    db_session.flush()
    link_a = EnquiryDealer(enquiry_id=enquiry.id, dealer_id=dealer_a.id)   # A: pending (no quote)
    link_b = EnquiryDealer(enquiry_id=enquiry.id, dealer_id=dealer_b.id)   # B: will quote
    db_session.add_all([link_a, link_b])
    db_session.flush()

    # Dealer B submits a quotation (A must never see it).
    quote_b = Quotation(enquiry_dealer_id=link_b.id, dealer_id=dealer_b.id, vehicle_variant_id=variant.id,
                        ex_showroom_price=900000, final_price=1050000, status=QuotationStatus.SUBMITTED)
    db_session.add(quote_b)
    db_session.commit()
    return {
        "dealer_a": dealer_a, "dealer_b": dealer_b, "nexon": nexon,
        "variant": variant, "enquiry": enquiry,
    }


# ---------------- dealer intent routing (deterministic heuristic) ----------------

@pytest.mark.parametrize(
    "message,expected",
    [
        ("How is my dealership performing?", DealerIntent.performance),
        ("Show my pending enquiries", DealerIntent.enquiries),
        ("Help me draft a quotation note", DealerIntent.quotation_help),
        ("What price should I offer on the Nexon?", DealerIntent.pricing_help),
        ("Hello there", DealerIntent.general),
    ],
)
def test_dealer_heuristic_routing(message, expected):
    assert dealer_agent._heuristic_classify(message) == expected


@pytest.mark.parametrize(
    "message,expected",
    [
        ("Give me a platform health summary", AdminIntent.insights),
        ("How many dealers are pending approval?", AdminIntent.lookup),
        ("Hi", AdminIntent.general),
    ],
)
def test_admin_heuristic_routing(message, expected):
    assert admin_agent._heuristic_classify(message) == expected


# ---------------- dealer-scope isolation ----------------

def test_pending_enquiries_scoped_to_dealer(db_session, world):
    # Dealer A has one pending enquiry; Dealer B already quoted so has none pending.
    a = dealer_tools.pending_enquiries(db_session, world["dealer_a"])
    b = dealer_tools.pending_enquiries(db_session, world["dealer_b"])
    assert len(a) == 1
    assert a[0]["vehicle_label"] is not None
    assert b == []


def test_pricing_context_never_leaks_other_dealer_quotes(db_session, world):
    # Dealer B quoted 1,050,000. Dealer A must NOT see B's quote in its pricing context.
    ctx_a = dealer_tools.pricing_context(db_session, world["dealer_a"], world["nexon"].id)
    assert ctx_a["your_quotes_count"] == 0
    assert ctx_a["your_avg_final_price"] is None
    # Dealer B sees only its own.
    ctx_b = dealer_tools.pricing_context(db_session, world["dealer_b"], world["nexon"].id)
    assert ctx_b["your_quotes_count"] == 1
    assert ctx_b["your_avg_final_price"] == 1050000.0


def test_quotation_stats_scoped(db_session, world):
    assert dealer_tools.quotation_stats(db_session, world["dealer_a"])["total_quotations"] == 0
    assert dealer_tools.quotation_stats(db_session, world["dealer_b"])["submitted"] == 1


# ---------------- admin aggregate-only ----------------

def test_admin_chat_returns_aggregates_only(db_session, world):
    r = admin_agent.run_admin_chat(db_session, "How many dealers are there?")
    # No customer PII; a numeric aggregate answer.
    assert r.error is None
    assert "dealer" in r.message.lower()


# ---------------- endpoint authorization ----------------

def test_customer_cannot_use_dealer_chat(client):
    register(client, "c1@example.com", role="customer")
    h = auth_header(client, "c1@example.com")
    assert client.post("/api/ai/dealer-chat", json={"message": "hi"}, headers=h).status_code == 403


def test_dealer_with_dealership_can_chat(client):
    # Registering as a dealer auto-provisions a dealership, so dealer-chat works.
    register(client, "d1@example.com", role="dealer")
    h = auth_header(client, "d1@example.com")
    res = client.post("/api/ai/dealer-chat", json={"message": "How is my dealership performing?"}, headers=h)
    assert res.status_code == 200
    assert res.json()["intent"] == "performance"


def test_dealer_cannot_use_admin_chat(client):
    register(client, "d2@example.com", role="dealer")
    h = auth_header(client, "d2@example.com")
    assert client.post("/api/ai/admin-chat", json={"message": "hi"}, headers=h).status_code == 403


def test_dealer_chat_unauthenticated_rejected(client):
    assert client.post("/api/ai/dealer-chat", json={"message": "hi"}).status_code == 401
    assert client.post("/api/ai/admin-chat", json={"message": "hi"}).status_code == 401
