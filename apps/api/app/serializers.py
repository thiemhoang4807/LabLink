from datetime import timezone

from app.models import Application, Document, Lab, Publication, User


def iso(value):
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def document_json(document: Document):
    return {"id": document.id, "kind": document.kind, "filename": document.filename,
            "size_bytes": document.size_bytes, "created_at": iso(document.created_at),
            "download_url": f"/api/documents/{document.id}/download"}


def user_json(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role,
            "bio": user.bio, "gpa": user.gpa, "skills": user.skills, "interests": user.interests,
            "major": user.major, "year": user.year, "university": user.university,
            "website": user.website, "consent_ai": user.consent_ai,
            "documents": [document_json(d) for d in user.documents]}


def publication_json(publication: Publication):
    return {key: getattr(publication, key) for key in ("id", "lab_id", "title", "abstract", "url", "year", "source", "topics", "keywords")}


def lab_json(lab: Lab, detail=False):
    data = {key: getattr(lab, key) for key in ("id", "owner_id", "name", "slug", "summary", "description", "topics", "skills", "min_gpa", "capacity", "location", "website", "is_open")}
    data.update(lecturer_name=lab.owner.name, publication_count=len(lab.publications))
    if detail:
        data["publications"] = [publication_json(p) for p in lab.publications]
    return data


def application_json(application: Application, viewer: User):
    # Withdrawal revokes the lecturer's live profile/document access. Keep the
    # status and event history visible without revealing later profile updates.
    profile_visible = viewer.role == "student" or application.status != "withdrawn"
    return {"id": application.id, "lab_id": application.lab_id, "lab_name": application.lab.name,
            "student_id": application.student_id, "student_name": application.student.name if profile_visible else "Hồ sơ đã rút",
            "student_email": application.student.email if profile_visible else "", "student_gpa": application.student.gpa if profile_visible else None,
            "student_skills": application.student.skills if profile_visible else [], "student_interests": application.student.interests if profile_visible else [],
            "cover_letter": application.cover_letter if profile_visible else "", "status": application.status,
            "created_at": iso(application.created_at), "updated_at": iso(application.updated_at),
            "history": [{"id": e.id, "from_status": e.from_status, "to_status": e.to_status,
                         "actor_id": e.actor_id, "note": e.note, "created_at": iso(e.created_at)} for e in application.history],
            "documents": [document_json(a.document) for a in application.attachments] if profile_visible else []}
