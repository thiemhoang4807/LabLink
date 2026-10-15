import io

from pypdf import PdfWriter
from sqlalchemy import select

from app.models import Application, ApplicationDocument, Document, LoginSession, User


def blank_pdf():
    data = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.write(data)
    return data.getvalue()


def test_auth_cookie_rotation_logout_and_csrf(client, login, db):
    assert client.get("/api/auth/me").status_code == 401
    client.headers.pop("X-Requested-With")
    assert client.post("/api/auth/login", json={"email": "student@lablink.demo", "password": "Demo@2026!"}).status_code == 403
    client.headers["X-Requested-With"] = "LabLink"
    response = client.post("/api/auth/login", json={"email": "student@lablink.demo", "password": "wrong-password"})
    assert response.status_code == 401
    user = login()
    old_cookie = client.cookies.get("lablink_session")
    assert user["role"] == "student"
    response = client.get("/api/auth/me")
    assert response.json()["user"]["email"] == "student@lablink.demo"
    login()
    new_cookie = client.cookies.get("lablink_session")
    assert old_cookie != new_cookie
    sessions = db.scalars(select(LoginSession)).all()
    assert len(sessions) == 1
    assert sessions[0].token_hash not in {old_cookie, new_cookie}
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_registration_validation_and_role_cannot_be_patched(client):
    payload = {"email": "new@example.com", "password": " strong-password ", "name": "New Student", "role": "student"}
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert response.json()["user"]["consent_ai"] is False
    assert client.patch("/api/profile", json={"role": "lecturer"}).status_code == 422
    assert client.patch("/api/profile", json={"gpa": 4.2}).status_code == 422
    assert client.patch("/api/profile", json={"website": "javascript:alert(1)"}).status_code == 422
    assert client.patch("/api/profile", json={"skills": ["Python", "python", " ReactJS "]}).json()["skills"] == ["Python", "ReactJS"]
    assert client.post("/api/auth/register", json=payload).status_code == 409
    assert client.post("/api/auth/login", json={"email": payload["email"], "password": "strong-password"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]}).status_code == 200


def test_csrf_rejects_disallowed_origin(client):
    response = client.post("/api/auth/login", headers={"Origin": "https://untrusted.example"}, json={"email": "student@lablink.demo", "password": "Demo@2026!"})
    assert response.status_code == 403


def test_lab_ownership(client, login):
    assert len(client.get("/api/labs").json()) == 6
    login()
    assert client.post("/api/labs", json={"name": "Student Lab"}).status_code == 403
    login("lecturer@lablink.demo")
    assert client.patch("/api/labs/4", json={"name": "Hijack"}).status_code == 403
    assert client.post("/api/labs/4/publications", json={"title": "Unauthorized paper"}).status_code == 403
    created = client.post("/api/labs", json={"name": "Responsible AI Lab", "topics": ["NLP"], "capacity": 3})
    assert created.status_code == 201
    lab_id = created.json()["id"]
    assert client.patch(f"/api/labs/{lab_id}", json={"is_open": False}).json()["is_open"] is False
    paper = client.post(f"/api/labs/{lab_id}/publications", json={"title": "Traceable retrieval", "year": 2026, "abstract": "Evaluation of research retrieval."})
    assert paper.status_code == 201
    assert client.get(f"/api/labs/{lab_id}").json()["publication_count"] == 1


def test_application_duplicate_ownership_state_machine_and_history(client, login):
    student = login()
    response = client.post("/api/applications", json={"lab_id": 1, "cover_letter": "Em mong muốn nghiên cứu NLP và xây dựng hệ thống RAG."})
    assert response.status_code == 201, response.text
    application_id = response.json()["id"]
    assert client.post("/api/applications", json={"lab_id": 1, "cover_letter": "Đơn trùng lặp không được phép gửi lần thứ hai."}).status_code == 409
    assert client.patch(f"/api/applications/{application_id}/status", json={"status": "accepted"}).status_code == 409
    own = client.get("/api/applications").json()
    assert all(a["student_id"] == student["id"] for a in own)
    login("lecturer2@lablink.demo")
    assert client.patch(f"/api/applications/{application_id}/status", json={"status": "reviewing"}).status_code == 404
    login("lecturer@lablink.demo")
    assert client.patch(f"/api/applications/{application_id}/status", json={"status": "accepted"}).status_code == 409
    for status in ("reviewing", "interview", "accepted"):
        result = client.patch(f"/api/applications/{application_id}/status", json={"status": status, "note": "Đã kiểm tra hồ sơ"})
        assert result.status_code == 200, result.text
    assert [e["to_status"] for e in result.json()["history"]] == ["submitted", "reviewing", "interview", "accepted"]
    assert client.patch(f"/api/applications/{application_id}/status", json={"status": "reviewing"}).status_code == 409


def test_student_withdraw_and_reapply(client, login):
    login()
    first = client.get("/api/applications").json()[0]
    assert client.patch(f"/api/applications/{first['id']}/status", json={"status": "withdrawn"}).status_code == 200
    assert client.post("/api/applications", json={"lab_id": first["lab_id"], "cover_letter": "Em đã cập nhật nguyện vọng nghiên cứu và muốn nộp lại hồ sơ."}).status_code == 201


def test_gpa_and_capacity_validation(client, login):
    login()
    assert client.patch("/api/profile", json={"gpa": 2.0}).status_code == 200
    assert client.post("/api/applications", json={"lab_id": 1, "cover_letter": "Em mong muốn được tham gia nghiên cứu tại phòng lab."}).status_code == 422
    login("lecturer@lablink.demo")
    assert client.patch("/api/labs/3", json={"capacity": 1}).status_code == 200
    login()
    client.patch("/api/profile", json={"gpa": 3.6})
    assert client.post("/api/applications", json={"lab_id": 3, "cover_letter": "Em mong muốn được tham gia nghiên cứu tại phòng lab."}).status_code == 409


def test_acceptance_cannot_exceed_lab_capacity(client, login):
    login("lecturer@lablink.demo")
    client.patch("/api/labs/1", json={"capacity": 1})
    applications = [a for a in client.get("/api/applications").json() if a["lab_id"] == 1]
    first = next(a for a in applications if a["status"] == "interview")
    second = next(a for a in applications if a["status"] == "reviewing")
    assert client.patch(f"/api/applications/{first['id']}/status", json={"status": "accepted"}).status_code == 200
    assert client.patch(f"/api/applications/{second['id']}/status", json={"status": "interview"}).status_code == 200
    assert client.patch(f"/api/applications/{second['id']}/status", json={"status": "accepted"}).status_code == 409
    result = next(a for a in client.get("/api/applications").json() if a["id"] == second["id"])
    assert result["status"] == "interview"
    assert result["history"][-1]["to_status"] == "interview"


def test_private_upload_application_snapshot_and_deletion(client, login, db):
    login()
    response = client.post("/api/documents", data={"kind": "cv"}, files={"file": ("cv.pdf", blank_pdf(), "application/pdf")})
    assert response.status_code == 201, response.text
    document_id = response.json()["id"]
    url = response.json()["download_url"]
    assert client.get(url).status_code == 200
    assert client.get(url).headers["content-disposition"].startswith("attachment;")
    login("lecturer@lablink.demo")
    assert client.get(url).status_code == 404  # Existing applications never expose later uploads.
    login()
    application = client.post("/api/applications", json={"lab_id": 1, "cover_letter": "Em mong muốn nghiên cứu NLP và kiểm chứng hệ thống RAG."})
    assert application.status_code == 201
    assert application.json()["documents"][0]["id"] == document_id
    login("lecturer@lablink.demo")
    assert client.get(url).status_code == 200
    assert client.delete(f"/api/documents/{document_id}").status_code == 404
    login("lecturer2@lablink.demo")
    assert client.get(url).status_code == 404
    login()
    assert client.delete(f"/api/documents/{document_id}").status_code == 200
    assert client.get(url).status_code == 404
    assert db.scalar(select(Document).where(Document.id == document_id)) is None


def test_document_validation_and_dashboard(client, login):
    login()
    assert client.post("/api/documents", data={"kind": "cv"}, files={"file": ("cv.pdf", b"not a pdf", "application/pdf")}).status_code == 422
    assert client.post("/api/documents", data={"kind": "cv"}, files={"file": ("cv.html", b"%PDF-invalid", "text/html")}).status_code == 422
    assert client.get("/api/dashboard").json()["total_applications"] == 2
    login("lecturer@lablink.demo")
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["owned_labs"] == 3
    assert dashboard["total_applications"] == 6
    assert client.get("/api/health").json()["status"] == "ok"


def test_chunked_requests_are_bounded_before_multipart_spooling(client):
    chunks = iter([b"x" * (1024 * 1024) for _ in range(6)])
    response = client.post("/api/auth/login", content=chunks, headers={"Content-Type": "application/json"})
    assert response.status_code == 413


def test_lab_capacity_cannot_drop_below_accepted_students(client, login):
    login("lecturer@lablink.demo")
    applications = [a for a in client.get("/api/applications").json() if a["lab_id"] == 1]
    first = next(a for a in applications if a["status"] == "interview")
    second = next(a for a in applications if a["status"] == "reviewing")
    assert client.patch(f"/api/applications/{first['id']}/status", json={"status": "accepted"}).status_code == 200
    assert client.patch(f"/api/applications/{second['id']}/status", json={"status": "interview"}).status_code == 200
    assert client.patch(f"/api/applications/{second['id']}/status", json={"status": "accepted"}).status_code == 200
    original_capacity = client.get("/api/labs/1").json()["capacity"]
    assert client.patch("/api/labs/1", json={"capacity": 1}).status_code == 409
    assert client.get("/api/labs/1").json()["capacity"] == original_capacity
    assert client.patch("/api/labs/1", json={"capacity": 2}).status_code == 200


def test_withdrawal_hides_live_profile_and_attachments_from_lecturer(client, login, db):
    student = login()
    own = next(a for a in client.get("/api/applications").json() if a["lab_id"] <= 3)
    document = Document(user_id=student["id"], kind="cv", filename="private-metadata.pdf", storage_key="private-metadata", size_bytes=100, extracted_text="Private CV text")
    db.add(document)
    db.flush()
    db.add(ApplicationDocument(application_id=own["id"], document_id=document.id))
    db.commit()
    assert client.patch(f"/api/applications/{own['id']}/status", json={"status": "withdrawn"}).status_code == 200
    changed = client.patch("/api/profile", json={"name": "PRIVATE NEW NAME", "skills": ["PRIVATE_NEW_SKILL"], "gpa": 3.91})
    assert changed.status_code == 200
    # The student's own history continues to include their own profile.
    student_view = next(a for a in client.get("/api/applications").json() if a["id"] == own["id"])
    assert student_view["student_name"] == "PRIVATE NEW NAME"
    assert student_view["documents"][0]["id"] == document.id
    login("lecturer@lablink.demo")
    lecturer_view = next(a for a in client.get("/api/applications").json() if a["id"] == own["id"])
    assert lecturer_view["student_name"] == "Hồ sơ đã rút"
    assert lecturer_view["student_email"] == ""
    assert lecturer_view["student_gpa"] is None
    assert lecturer_view["student_skills"] == []
    assert lecturer_view["student_interests"] == []
    assert lecturer_view["documents"] == []
    assert lecturer_view["cover_letter"] == ""
    assert lecturer_view["history"][-1]["to_status"] == "withdrawn"
