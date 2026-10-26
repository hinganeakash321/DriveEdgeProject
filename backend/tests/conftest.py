"""Pytest fixtures: isolated in-memory DB and TestClient."""
from __future__ import annotations

import os

os.environ["DATABASE_URL"] = "sqlite:///./test_driveedge.db"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["ANTHROPIC_BASE_URL"] = ""
os.environ["ANTHROPIC_API_KEY_HELPER"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  register models
from app.core.db import Base, get_db
from app.main import app


@pytest.fixture()
def db_session(tmp_path):
    db_file = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register(client, email, role="customer", password="Password123", name="Test User"):
    return client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password, "role": role},
    )


def auth_header(client, email, password="Password123"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
