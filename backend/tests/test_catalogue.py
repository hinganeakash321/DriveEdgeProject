"""Catalogue search/filter and AI car-finder (mocked Claude) tests."""
import json
from datetime import datetime, timezone

import pytest

from app.ai.schemas import CarFinderRequest
from app.ai import car_finder
from app.models import Manufacturer, VehicleModel, VehicleVariant
from app.models.enums import FuelType, Transmission


@pytest.fixture()
def seeded(db_session):
    m = Manufacturer(name="Tata Motors", slug="tata", active=True)
    db_session.add(m)
    db_session.flush()
    model = VehicleModel(manufacturer_id=m.id, model_name="Nexon", slug="tata-nexon", body_type="SUV", active=True)
    db_session.add(model)
    db_session.flush()
    db_session.add_all([
        VehicleVariant(vehicle_model_id=model.id, variant_name="Base", fuel_type=FuelType.PETROL,
                       transmission=Transmission.MANUAL, ex_showroom_price=800000, seating_capacity=5, active=True),
        VehicleVariant(vehicle_model_id=model.id, variant_name="Auto", fuel_type=FuelType.PETROL,
                       transmission=Transmission.AUTOMATIC, ex_showroom_price=1200000, seating_capacity=5, active=True),
    ])
    db_session.commit()
    return model


def test_list_cars_returns_seeded_model(client, seeded):
    res = client.get("/api/cars")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["model_name"] == "Nexon"
    assert data["items"][0]["min_price"] == "800000.00"
    assert data["items"][0]["max_price"] == "1200000.00"


def test_price_filter(client, seeded):
    # Max price below cheapest variant returns nothing
    res = client.get("/api/cars?max_price=500000")
    assert res.json()["total"] == 0
    # Within range returns the model
    res = client.get("/api/cars?max_price=900000")
    assert res.json()["total"] == 1


def test_fuel_and_transmission_filter(client, seeded):
    res = client.get("/api/cars?transmission=automatic")
    assert res.json()["total"] == 1
    res = client.get("/api/cars?fuel_type=diesel")
    assert res.json()["total"] == 0


def test_invalid_enum_filter_does_not_error(client, seeded):
    """An unknown fuel/transmission value is ignored, not a 500 (robustness)."""
    res = client.get("/api/cars?fuel_type=%3CUNKNOWN%3E")
    assert res.status_code == 200
    res = client.get("/api/cars?transmission=warp-drive")
    assert res.status_code == 200


def test_vehicle_detail_includes_disclaimer(client, seeded):
    res = client.get(f"/api/cars/{seeded.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["disclaimer"]
    assert len(body["variants"]) == 2


def test_car_finder_degrades_without_claude(db_session, seeded):
    """With Claude unconfigured, deterministic filtering still returns real vehicles only."""
    req = CarFinderRequest(message="SUV under 15 lakh automatic")
    result = car_finder.run_car_finder(db_session, req)
    assert result.ai_generated is False  # Claude not configured in tests
    # Hard constraint enforced: only the real seeded vehicle may appear
    for rec in result.recommendations:
        assert rec.vehicle_id == seeded.id
    assert result.preferences.body_type == "SUV"
    assert result.preferences.transmission == "automatic"
