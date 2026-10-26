"""Admin catalogue management: authorization + CRUD + audit logging."""
import pytest

from app.core.security import hash_password
from app.models import AuditLog, Manufacturer, User, VehicleModel
from app.models.enums import AccountStatus, UserRole
from tests.conftest import auth_header, register


@pytest.fixture()
def admin(db_session):
    u = User(
        name="Admin", email="admin@example.com", password_hash=hash_password("Password123"),
        role=UserRole.ADMIN, status=AccountStatus.ACTIVE,
    )
    db_session.add(u)
    m = Manufacturer(name="Tata Motors", slug="tata", active=True)
    db_session.add(m)
    db_session.commit()
    return u, m


def test_cannot_self_register_as_admin(client):
    """Public registration must reject privileged roles (no privilege escalation)."""
    res = client.post(
        "/api/auth/register",
        json={"name": "Sneaky", "email": "sneaky@example.com", "password": "Password123", "role": "admin"},
    )
    assert res.status_code == 403


def test_customer_cannot_access_admin_catalogue(client, admin):
    register(client, "cust@example.com")
    h = auth_header(client, "cust@example.com")
    assert client.get("/api/admin/models", headers=h).status_code == 403
    assert client.post(
        "/api/admin/variants",
        json={"vehicle_model_id": 1, "variant_name": "X", "fuel_type": "petrol", "transmission": "manual"},
        headers=h,
    ).status_code == 403


def test_admin_create_model_and_variant_with_audit(client, admin, db_session):
    _, mfr = admin
    h = auth_header(client, "admin@example.com")

    res = client.post(
        "/api/admin/models",
        json={"manufacturer_id": mfr.id, "model_name": "Harrier", "slug": "tata-harrier", "body_type": "SUV"},
        headers=h,
    )
    assert res.status_code == 201
    model_id = res.json()["id"]

    res = client.post(
        "/api/admin/variants",
        json={
            "vehicle_model_id": model_id, "variant_name": "XZ", "fuel_type": "diesel",
            "transmission": "automatic", "ex_showroom_price": 2000000, "seating_capacity": 5,
        },
        headers=h,
    )
    assert res.status_code == 201

    # Appears in admin model listing with its variant counted.
    models = client.get("/api/admin/models", headers=h).json()
    harrier = next(m for m in models if m["id"] == model_id)
    assert harrier["variant_count"] == 1

    # Audit log recorded both actions.
    actions = {a.action for a in db_session.query(AuditLog).all()}
    assert {"create_model", "create_variant"}.issubset(actions)


def test_admin_rejects_invalid_fuel_type(client, admin):
    _, mfr = admin
    h = auth_header(client, "admin@example.com")
    res = client.post(
        "/api/admin/models",
        json={"manufacturer_id": mfr.id, "model_name": "Safari", "slug": "tata-safari", "body_type": "SUV"},
        headers=h,
    )
    model_id = res.json()["id"]
    res = client.post(
        "/api/admin/variants",
        json={"vehicle_model_id": model_id, "variant_name": "X", "fuel_type": "nuclear", "transmission": "manual"},
        headers=h,
    )
    assert res.status_code == 422


def test_admin_toggle_model_active(client, admin, db_session):
    _, mfr = admin
    h = auth_header(client, "admin@example.com")
    model = VehicleModel(manufacturer_id=mfr.id, model_name="Punch", slug="tata-punch", body_type="SUV", active=True)
    db_session.add(model)
    db_session.commit()
    res = client.patch(f"/api/admin/models/{model.id}", json={"active": False}, headers=h)
    assert res.status_code == 200
    assert res.json()["active"] is False
