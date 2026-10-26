"""Dealer 'market position' block: exposes only anonymized aggregates + the
dealer's own rank, and never leaks a competitor's identity or breakdown."""
import json

import pytest

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
from tests.conftest import auth_header


@pytest.fixture()
def market_world(db_session):
    """One enquiry fanned to two dealerships; both submit quotations at
    different final prices so rank/lowest/gap are well-defined."""
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

    owner_a = mk_user("dealera@example.com", UserRole.DEALER)
    owner_b = mk_user("dealerb@example.com", UserRole.DEALER)
    customer = mk_user("cust@example.com", UserRole.CUSTOMER)

    dealer_a = Dealer(dealer_name="Dealer A", city="Pune", owner_user_id=owner_a.id,
                      verification_status=VerificationStatus.VERIFIED)
    dealer_b = Dealer(dealer_name="SecretCompetitor Motors", city="Mumbai", owner_user_id=owner_b.id,
                      verification_status=VerificationStatus.VERIFIED)
    db_session.add_all([dealer_a, dealer_b])
    db_session.flush()
    db_session.add_all([
        DealerManufacturer(dealer_id=dealer_a.id, manufacturer_id=tata.id),
        DealerManufacturer(dealer_id=dealer_b.id, manufacturer_id=tata.id),
    ])

    enquiry = CustomerEnquiry(customer_id=customer.id, vehicle_variant_id=variant.id, location="Pune")
    db_session.add(enquiry)
    db_session.flush()
    link_a = EnquiryDealer(enquiry_id=enquiry.id, dealer_id=dealer_a.id, response_status="responded")
    link_b = EnquiryDealer(enquiry_id=enquiry.id, dealer_id=dealer_b.id, response_status="responded")
    db_session.add_all([link_a, link_b])
    db_session.flush()

    # Dealer A quotes higher (1,100,000); Dealer B is the lowest (1,000,000).
    db_session.add_all([
        Quotation(enquiry_dealer_id=link_a.id, dealer_id=dealer_a.id, vehicle_variant_id=variant.id,
                  ex_showroom_price=900000, final_price=1100000, status=QuotationStatus.SUBMITTED),
        Quotation(enquiry_dealer_id=link_b.id, dealer_id=dealer_b.id, vehicle_variant_id=variant.id,
                  ex_showroom_price=900000, final_price=1000000, status=QuotationStatus.SUBMITTED),
    ])
    db_session.commit()
    return {"link_a": link_a.id, "dealer_b_name": dealer_b.dealer_name}


def test_market_block_reports_rank_and_lowest(client, market_world):
    h = auth_header(client, "dealera@example.com")
    res = client.get(f"/api/dealer/enquiries/{market_world['link_a']}", headers=h)
    assert res.status_code == 200
    market = res.json()["market"]
    assert market["total_quotes"] == 2
    assert market["lowest_final_price"] == 1000000.0
    assert market["your_final_price"] == 1100000.0
    assert market["your_rank"] == 2          # A is the more expensive of two
    assert market["gap_to_lowest"] == 100000.0
    assert market["is_lowest"] is False


def test_market_block_never_leaks_competitor_identity(client, market_world):
    h = auth_header(client, "dealera@example.com")
    res = client.get(f"/api/dealer/enquiries/{market_world['link_a']}", headers=h)
    body = json.dumps(res.json())
    # The competitor's name/city must never appear anywhere in the dealer's view.
    assert market_world["dealer_b_name"] not in body
    assert "dealer_id" not in json.dumps(res.json()["market"])
    assert "dealer_name" not in json.dumps(res.json()["market"])
