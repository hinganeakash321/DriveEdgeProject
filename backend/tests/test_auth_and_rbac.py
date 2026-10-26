"""Auth, RBAC, and data-isolation tests."""
from tests.conftest import auth_header, register


def test_register_and_login(client):
    res = register(client, "a@driveedge.in")
    assert res.status_code == 201
    assert "access_token" in res.json()

    me = client.get("/api/auth/me", headers=auth_header(client, "a@driveedge.in"))
    assert me.status_code == 200
    assert me.json()["email"] == "a@driveedge.in"


def test_duplicate_email_rejected(client):
    register(client, "dup@driveedge.in")
    res = register(client, "dup@driveedge.in")
    assert res.status_code == 409


def test_login_invalid_password(client):
    register(client, "b@driveedge.in")
    res = client.post("/api/auth/login", json={"email": "b@driveedge.in", "password": "wrong"})
    assert res.status_code == 401


def test_protected_endpoint_requires_auth(client):
    res = client.get("/api/enquiries")
    assert res.status_code == 401


def test_customer_cannot_access_dealer_endpoints(client):
    register(client, "cust@driveedge.in", role="customer")
    headers = auth_header(client, "cust@driveedge.in")
    res = client.get("/api/dealer/analytics", headers=headers)
    assert res.status_code == 403


def test_customer_cannot_access_admin_endpoints(client):
    register(client, "cust2@driveedge.in", role="customer")
    headers = auth_header(client, "cust2@driveedge.in")
    res = client.get("/api/admin/overview", headers=headers)
    assert res.status_code == 403


def test_enquiry_data_isolation(client):
    # Customer A creates an enquiry; Customer B must not see it.
    register(client, "ca@driveedge.in", role="customer")
    register(client, "cb@driveedge.in", role="customer")
    ha = auth_header(client, "ca@driveedge.in")
    hb = auth_header(client, "cb@driveedge.in")

    created = client.post("/api/enquiries", json={"location": "Pune", "message": "hi"}, headers=ha)
    assert created.status_code == 201
    enquiry_id = created.json()["id"]

    # B cannot fetch A's enquiry
    res_b = client.get(f"/api/enquiries/{enquiry_id}", headers=hb)
    assert res_b.status_code == 404

    # A sees exactly one; B sees none
    assert len(client.get("/api/enquiries", headers=ha).json()) == 1
    assert len(client.get("/api/enquiries", headers=hb).json()) == 0
