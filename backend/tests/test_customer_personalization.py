"""Favourites / saved searches / recently viewed: ownership isolation."""
import pytest

from app.models import Manufacturer, VehicleModel, VehicleVariant
from app.models.enums import FuelType, Transmission
from tests.conftest import auth_header, register


@pytest.fixture()
def model(db_session):
    m = Manufacturer(name="Hyundai", slug="hyundai", active=True)
    db_session.add(m)
    db_session.flush()
    vm = VehicleModel(manufacturer_id=m.id, model_name="Creta", slug="hyundai-creta", body_type="SUV", active=True)
    db_session.add(vm)
    db_session.flush()
    db_session.add(
        VehicleVariant(
            vehicle_model_id=vm.id, variant_name="S", fuel_type=FuelType.PETROL,
            transmission=Transmission.MANUAL, ex_showroom_price=1100000, seating_capacity=5, active=True,
        )
    )
    db_session.commit()
    return vm


def test_favourite_add_list_remove(client, model):
    register(client, "fav@example.com")
    h = auth_header(client, "fav@example.com")

    res = client.post("/api/favourites", json={"vehicle_model_id": model.id}, headers=h)
    assert res.status_code == 201
    assert res.json()["created"] is True

    # Adding again is idempotent (no duplicate).
    res = client.post("/api/favourites", json={"vehicle_model_id": model.id}, headers=h)
    assert res.json()["created"] is False

    res = client.get("/api/favourites", headers=h)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["vehicle_model_id"] == model.id

    res = client.delete(f"/api/favourites/{model.id}", headers=h)
    assert res.status_code == 204
    assert client.get("/api/favourites", headers=h).json() == []


def test_favourites_isolated_between_customers(client, model):
    register(client, "a@example.com")
    register(client, "b@example.com")
    ha = auth_header(client, "a@example.com")
    hb = auth_header(client, "b@example.com")

    client.post("/api/favourites", json={"vehicle_model_id": model.id}, headers=ha)

    # B must not see A's favourite.
    assert client.get("/api/favourites", headers=hb).json() == []
    assert len(client.get("/api/favourites", headers=ha).json()) == 1


def test_saved_search_crud_and_ownership(client, model):
    register(client, "c@example.com")
    register(client, "d@example.com")
    hc = auth_header(client, "c@example.com")
    hd = auth_header(client, "d@example.com")

    res = client.post(
        "/api/saved-searches",
        json={"name": "Cheap SUVs", "query_params": {"body_type": "SUV", "max_price": 1500000}},
        headers=hc,
    )
    assert res.status_code == 201
    sid = res.json()["id"]

    assert len(client.get("/api/saved-searches", headers=hc).json()) == 1
    assert client.get("/api/saved-searches", headers=hd).json() == []

    # D cannot delete C's saved search.
    assert client.delete(f"/api/saved-searches/{sid}", headers=hd).status_code == 404
    assert client.delete(f"/api/saved-searches/{sid}", headers=hc).status_code == 204


def test_recently_viewed_dedup_and_isolation(client, model):
    register(client, "e@example.com")
    he = auth_header(client, "e@example.com")
    client.post("/api/recently-viewed", json={"vehicle_model_id": model.id}, headers=he)
    client.post("/api/recently-viewed", json={"vehicle_model_id": model.id}, headers=he)
    rows = client.get("/api/recently-viewed", headers=he).json()
    assert len(rows) == 1  # de-duplicated in output


def test_favourites_requires_customer_auth(client, model):
    # Unauthenticated request is rejected.
    assert client.get("/api/favourites").status_code == 401
