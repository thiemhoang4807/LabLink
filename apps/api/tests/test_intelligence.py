"""Behavior and privacy checks; no paid API calls or live crawling required."""
import json

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Application, ApplicationDocument, Document, Lab, Publication, ResearchChunk, User
from app.services import intelligence as ai


@pytest.mark.parametrize("query,operator,threshold", [
    ("ReactJS, GPA > 3.2 và AI", ">", 3.2),
    ("GPA >= 3.2", ">=", 3.2),
    ("GPA trên 3,2", ">", 3.2),
    ("điểm trung bình tối thiểu 3.0", ">=", 3.0),
    ("GPA <= 2.8", "<=", 2.8),
])
def test_parse_gpa_operators(query, operator, threshold):
    assert ai.extract_filters(query)["gpa"] == {"operator": operator, "value": threshold}


def test_strict_filters_and_aliases():
    filters = ai.extract_filters("ReactJS, Python, GPA > 3.2 và muốn nghiên cứu AI")
    record = {"gpa": 3.2, "skills": ["React.js", "Python"], "topics": ["NLP"]}
    assert not ai.matches_filters(record, filters)
    record["gpa"] = 3.21
    assert ai.matches_filters(record, filters)
    record["skills"] = ["Python"]
    assert not ai.matches_filters(record, filters)
    record["gpa"] = None
    assert not ai.matches_filters(record, filters)
    assert ai.canonical_skills(["ReactJS"]) == {"React"}


def test_topic_and_skill_boundaries():
    assert "AI" not in ai.classify_text("chair retail painting")['topics']
    assert ai.extract_filters("AI và NLP")["topics"] == ["NLP"]
    assert "Java" not in ai.extract_filters("JavaScript")["skills"]
    assert ai.classify_text("Xử lý ngôn ngữ tự nhiên với PyTorch")['topics'] == ["NLP"]


def test_explicit_or_negation_custom_skills_and_gpa_ranges():
    either = ai.extract_filters("Tìm ứng viên biết React hoặc Python")
    assert either["skills_any"] == ["React", "Python"]
    assert ai.matches_filters({"skills": ["React"], "topics": []}, either)
    assert ai.matches_filters({"skills": ["Python"], "topics": []}, either)
    assert not ai.matches_filters({"skills": ["Java"], "topics": []}, either)

    excluded = ai.extract_filters("Tìm ứng viên có React nhưng không biết Python")
    assert excluded["skills"] == ["React"]
    assert excluded["skills_excluded"] == ["Python"]
    assert ai.matches_filters({"skills": ["React"], "topics": []}, excluded)
    assert not ai.matches_filters({"skills": ["React", "Python"], "topics": []}, excluded)

    custom = ai.extract_filters("Tìm ứng viên có React và Kubernetes")
    assert set(custom["skills"]) == {"React", "Kubernetes"}
    assert ai.matches_filters({"skills": ["React", "Kubernetes"], "topics": []}, custom)
    assert not ai.matches_filters({"skills": ["React"], "topics": []}, custom)

    ranged = ai.extract_filters("Tìm sinh viên GPA từ 3.2 đến 3.5")
    assert ranged["gpa_conditions"] == [
        {"operator": ">=", "value": 3.2},
        {"operator": "<=", "value": 3.5},
    ]
    assert not ai.matches_filters({"gpa": 3.8, "skills": [], "topics": []}, ranged)
    multiple = ai.extract_filters("GPA > 3.2 và GPA < 3.5")
    assert len(multiple["gpa_conditions"]) == 2
    assert not ai.matches_filters({"gpa": 3.8, "skills": [], "topics": []}, multiple)


def test_student_gpa_is_checked_against_lab_minimum():
    query = ai.extract_filters("Tìm lab phù hợp với GPA 3.2 của tôi")
    eligible = {"type": "lab", "gpa": 3.0, "skills": [], "topics": []}
    ineligible = {"type": "lab", "gpa": 3.8, "skills": [], "topics": []}
    assert ai.matches_filters(eligible, query, applicant_gpa=3.2)
    assert not ai.matches_filters(ineligible, query, applicant_gpa=3.2)
    assert not ai.matches_filters(eligible, query, applicant_gpa=None)


def test_stable_local_vectors():
    vector = ai.local_embedding("Python NLP xử lý ngôn ngữ")
    assert len(vector) == ai.DIMENSIONS
    assert vector == ai.local_embedding("Python NLP xử lý ngôn ngữ")
    assert ai.cosine(vector, vector) == pytest.approx(1)
    assert ai.cosine([], vector) == 0
    assert ai.local_embedding("") == [0.0] * ai.DIMENSIONS


@pytest.fixture
def dataset(monkeypatch):
    monkeypatch.setenv("AI_MODE", "local")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as db:
        users = [
            User(name="Lecturer One", email="one@example.test", role="lecturer", password_hash="test", consent_ai=True),
            User(name="Lecturer Two", email="two@example.test", role="lecturer", password_hash="test", consent_ai=True),
            User(name="Visible Student", email="visible@example.test", role="student", password_hash="test", bio="PRIVATE_BIO_MARKER", gpa=3.4, skills=["ReactJS", "Python"], interests=["AI"], consent_ai=False),
            User(name="Private Other Lab Student", email="private@example.test", role="student", password_hash="test", gpa=4, skills=["React", "Python"], interests=["AI"], consent_ai=True),
            User(name="No Application", email="none@example.test", role="student", password_hash="test", gpa=4, skills=["React", "Python"], interests=["AI"], consent_ai=True),
        ]
        db.add_all(users)
        db.flush()
        lab1 = Lab(owner_id=users[0].id, name="NLP Lab", slug="nlp", topics=["NLP"], skills=["React", "Python"], min_gpa=3.2)
        lab2 = Lab(owner_id=users[1].id, name="AI Lab", slug="ai", topics=["AI"], skills=["React"], min_gpa=3)
        db.add_all([lab1, lab2])
        db.flush()
        db.add_all([Application(student_id=users[2].id, lab_id=lab1.id), Application(student_id=users[3].id, lab_id=lab2.id)])
        db.commit()
        yield db, users, [lab1, lab2]
    engine.dispose()


def test_lecturer_retrieval_isolated_before_indexing(dataset):
    db, users, _ = dataset
    result = ai.answer_query(db, users[0], "Tìm sinh viên ReactJS GPA > 3.2 muốn làm AI")
    assert [source["title"] for source in result["sources"]] == ["Visible Student"]
    chunks = db.scalars(select(ResearchChunk)).all()
    assert chunks
    assert {chunk.user_id for chunk in chunks} == {users[2].id}
    assert all("Private Other Lab" not in chunk.content for chunk in chunks)
    assert not ai.answer_query(db, users[0], "React GPA > 3.4 AI")["sources"]


def test_student_only_receives_public_labs(dataset):
    db, users, labs = dataset
    labs[1].is_open = False
    db.commit()
    result = ai.answer_query(db, users[2], "Tìm lab AI")
    assert {source["id"] for source in result["sources"]} == {f"lab:{labs[0].id}"}
    assert all(source["type"] == "lab" for source in result["sources"])


def test_personalized_student_query_uses_profile_with_hard_topics(dataset, monkeypatch):
    db, users, _ = dataset
    users[2].skills = ["Python"]
    seen = []
    original = ai.local_embedding

    def capture(text):
        seen.append(text)
        return original(text)

    monkeypatch.setattr(ai, "local_embedding", capture)
    ai.answer_query(db, users[2], "Tìm lab về AI phù hợp với kỹ năng của tôi")
    assert any("Python" in text for text in seen)


def test_lab_research_answer_quotes_a_persisted_publication_source(dataset):
    db, users, labs = dataset
    db.add(Publication(lab_id=labs[0].id, title="NLP retrieval demonstration", abstract="Retrieval for natural language processing", url="https://uit.edu.vn/research-demo", year=2026))
    db.commit()
    result = ai.answer_query(db, users[2], "NLP retrieval")
    source = next(source for source in result["sources"] if source["entity_id"] == labs[0].id)
    assert "NLP retrieval demonstration (2026)" in source["excerpt"]
    assert source["url"] == "https://uit.edu.vn/research-demo"


def test_no_external_call_without_every_profile_consent(dataset, monkeypatch):
    db, users, _ = dataset
    monkeypatch.setenv("AI_MODE", "openai")
    def forbidden(*_args, **_kwargs):
        pytest.fail("A provider was called for a profile without consent")
    monkeypatch.setattr(ai.OpenAIProvider, "embed", forbidden)
    result = ai.answer_query(db, users[0], "React AI")
    assert result["mode"] == "local"
    assert result["sources"]
    assert result["warning"]


def test_provider_failure_is_explicit_local_fallback(dataset, monkeypatch):
    db, users, _ = dataset
    users[2].consent_ai = True
    db.commit()
    monkeypatch.setenv("AI_MODE", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = ai.answer_query(db, users[0], "React AI")
    assert result["mode"] == "local_fallback"
    assert result["sources"]
    assert result["warning"]


def test_remote_payload_excludes_identifiers_documents_and_raw_chat(dataset, monkeypatch):
    db, users, _ = dataset
    users[2].consent_ai = True
    cv = Document(user_id=users[2].id, kind="cv", filename="private-cv.pdf", storage_key="fake-key", size_bytes=100, extracted_text="RAW_CV_MARKER React")
    db.add(cv)
    db.flush()
    application = db.scalar(select(Application).where(Application.student_id == users[2].id))
    db.add(ApplicationDocument(application_id=application.id, document_id=cv.id))
    db.commit()
    monkeypatch.setenv("AI_MODE", "openai")
    captured = []
    class FakeProvider:
        embedding_model = "test-embedding"
        def embed(self, contents):
            captured.extend(contents)
            return [ai.local_embedding(text) for text in contents]
        def rerank(self, filters, records):
            captured.append(json.dumps({"filters": filters, "sources": [record["remote_content"] for record in records]}))
            return [record["id"] for record in records]
    monkeypatch.setattr(ai, "OpenAIProvider", FakeProvider)
    result = ai.answer_query(db, users[0], "React AI PRIVATE_CHAT_MARKER")
    payload = " ".join(captured)
    assert result["mode"] == "openai"
    for private_value in ("Visible Student", "visible@example.test", "PRIVATE_BIO_MARKER", "PRIVATE_CHAT_MARKER", "RAW_CV_MARKER"):
        assert private_value not in payload
    assert "ReactJS" in payload


def test_local_cv_retrieval_uses_only_submitted_owned_snapshots(dataset):
    db, users, _ = dataset
    documents = [
        Document(user_id=users[2].id, kind="cv", filename="submitted.pdf", storage_key="submitted", size_bytes=100, extracted_text="Kubernetes graph orchestration project"),
        Document(user_id=users[2].id, kind="cv", filename="future.pdf", storage_key="future", size_bytes=100, extracted_text="FUTURE_UPLOAD_MARKER"),
        Document(user_id=users[2].id, kind="transcript", filename="grades.pdf", storage_key="grades", size_bytes=100, extracted_text="RAW_TRANSCRIPT_MARKER"),
        Document(user_id=users[3].id, kind="cv", filename="other.pdf", storage_key="other", size_bytes=100, extracted_text="OTHER_LAB_CV_MARKER"),
    ]
    db.add_all(documents)
    db.flush()
    own_application = db.scalar(select(Application).where(Application.student_id == users[2].id))
    other_application = db.scalar(select(Application).where(Application.student_id == users[3].id))
    db.add_all([
        ApplicationDocument(application_id=own_application.id, document_id=documents[0].id),
        ApplicationDocument(application_id=own_application.id, document_id=documents[2].id),
        ApplicationDocument(application_id=other_application.id, document_id=documents[3].id),
    ])
    db.commit()
    records = ai.scoped_records(db, users[0])
    contents = " ".join(record["content"] for record in records)
    assert "Kubernetes" in contents
    for marker in ("FUTURE_UPLOAD_MARKER", "RAW_TRANSCRIPT_MARKER", "OTHER_LAB_CV_MARKER"):
        assert marker not in contents
    result = ai.answer_query(db, users[0], "Kubernetes")
    assert result["sources"][0]["document_id"] == documents[0].id
    assert "Kubernetes" in result["sources"][0]["excerpt"]
    # CV text supplies soft evidence, never a replacement for declared hard skills.
    documents[0].extracted_text += " PyTorch"
    db.commit()
    assert not ai.answer_query(db, users[0], "PyTorch")["sources"]
    own_application.status = "withdrawn"
    db.commit()
    assert not ai.answer_query(db, users[0], "Kubernetes")["sources"]


def test_match_explains_gpa_gap(dataset):
    _, users, labs = dataset
    users[2].gpa = 3.1
    result = ai.profile_lab_match(users[2], labs[0])
    assert result["eligible_gpa"] is False
    assert any("thấp hơn" in gap for gap in result["gaps"])
    assert result["reasons"]


@pytest.mark.parametrize("url", [
    "http://www.uit.edu.vn/research", "https://127.0.0.1/", "https://user:password@uit.edu.vn/",
    "https://uit.edu.vn:8443/", "https://uit.edu.vn.attacker.test/", "https://scholar.google.com/",
])
def test_crawler_rejects_unsafe_urls(url, monkeypatch):
    monkeypatch.setenv("CRAWL_ALLOWED_HOSTS", "uit.edu.vn")
    with pytest.raises(ai.CrawlError):
        ai.validate_crawl_url(url, resolve=False)


def test_crawler_rejects_private_dns(monkeypatch):
    monkeypatch.setenv("CRAWL_ALLOWED_HOSTS", "uit.edu.vn")
    monkeypatch.setattr(ai.socket, "getaddrinfo", lambda *_args, **_kwargs: [(2, 1, 6, "", ("127.0.0.1", 443))])
    with pytest.raises(ai.CrawlError, match="mạng riêng"):
        ai.validate_crawl_url("https://uit.edu.vn/research")


def test_robots_disallow_is_enforced(monkeypatch):
    monkeypatch.setattr(ai, "_download_once", lambda *_args, **_kwargs: ai.Download(200, "User-agent: *\nDisallow: /private", "text/plain", None))
    assert not ai.robots_allowed("https://uit.edu.vn/private/research")
    assert ai.robots_allowed("https://uit.edu.vn/research")


def test_crawler_metadata_preview_does_not_invent_publications(monkeypatch):
    monkeypatch.setattr(ai, "validate_crawl_url", lambda url, **_kwargs: (url, ["1.1.1.1"]))
    monkeypatch.setattr(ai, "robots_allowed", lambda _url: True)
    monkeypatch.setattr(ai, "_download_once", lambda _url: ai.Download(200, '<title>NLP Lab</title><meta name="description" content="Natural language processing research"><p>Our projects</p>', "text/html", None))
    result = ai.preview_research_import("https://uit.edu.vn/research")
    assert result["title"] == "NLP Lab"
    assert result["topics"] == ["NLP"]
    assert result["publications"] == []


def test_ai_routes_authentication_and_import_ownership(client, login, monkeypatch):
    monkeypatch.setenv("AI_MODE", "local")
    def forbidden(*_args, **_kwargs):
        pytest.fail("Unauthorized import must be rejected before any network call")
    monkeypatch.setattr("app.routers.intelligence.preview_research_import", forbidden)
    assert client.post("/api/ai/chat", json={"message": "AI"}).status_code == 401
    login()
    assert client.get("/api/ai/matches").status_code == 200
    assert client.post("/api/ai/import", json={"url": "https://uit.edu.vn/research", "lab_id": 1}).status_code == 403
    client.post("/api/auth/logout")
    login("lecturer@lablink.demo")
    assert client.get("/api/ai/matches").status_code == 403
    assert client.post("/api/ai/import", json={"url": "https://uit.edu.vn/research", "lab_id": 4}).status_code == 404
    assert client.post("/api/ai/import/confirm", json={"lab_id": 4, "source_url": "https://uit.edu.vn/research", "title": "Research paper"}).status_code == 404


def test_import_confirmation_persists_only_reviewed_metadata(client, login, monkeypatch):
    monkeypatch.setenv("CRAWL_ALLOWED_HOSTS", "uit.edu.vn")
    login("lecturer@lablink.demo")
    payload = {"lab_id": 1, "source_url": "https://uit.edu.vn/research-demo", "title": "NLP research demonstration", "abstract": "Natural language processing with PyTorch", "year": 2026}
    result = client.post("/api/ai/import/confirm", json=payload)
    assert result.status_code == 201, result.text
    assert result.json()["source"] == "university_import_confirmed"
    assert result.json()["topics"] == ["NLP"]
    assert client.post("/api/ai/import/confirm", json=payload).status_code == 409
    payload["source_url"] = "https://127.0.0.1/"
    assert client.post("/api/ai/import/confirm", json=payload).status_code == 422
