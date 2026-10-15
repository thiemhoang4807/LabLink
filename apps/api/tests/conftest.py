import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.seed import seed_demo


@pytest.fixture
def session_factory(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def fk(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        seed_demo(session)
    yield factory
    engine.dispose()


@pytest.fixture
def db(session_factory):
    with session_factory() as session:
        yield session


@pytest.fixture
def client(session_factory, tmp_path, monkeypatch):
    import app.main as main
    from app.config import settings
    from app.routers.auth import _attempts

    _attempts.clear()
    monkeypatch.setattr(main, "engine", session_factory.kw["bind"])
    monkeypatch.setattr(main, "SessionLocal", session_factory)
    monkeypatch.setattr(settings, "storage_dir", tmp_path / "uploads")
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "seed_demo", True)
    monkeypatch.setattr(settings, "cookie_secure", False)
    application = main.create_app()

    def override_db():
        with session_factory() as session:
            try:
                yield session
            except Exception:
                session.rollback()
                raise

    application.dependency_overrides[get_db] = override_db
    with TestClient(application, headers={"X-Requested-With": "LabLink"}) as test_client:
        yield test_client


@pytest.fixture
def login(client):
    def perform(email="student@lablink.demo", password="Demo@2026!"):
        response = client.post("/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return response.json()["user"]
    return perform
