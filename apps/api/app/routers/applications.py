from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import ACTIVE_STATUSES, Application, ApplicationDocument, ApplicationEvent, Document, Lab, ResearchChunk, User, utcnow
from app.schemas import ApplicationInput, StatusInput
from app.serializers import application_json

router = APIRouter(prefix="/api/applications", tags=["Applications"])
TRANSITIONS = {"submitted": {"reviewing", "rejected"}, "reviewing": {"interview", "rejected"}, "interview": {"accepted", "rejected"}}


def scoped_applications(user: User):
    statement = select(Application)
    if user.role == "student":
        statement = statement.where(Application.student_id == user.id)
    else:
        statement = statement.join(Lab).where(Lab.owner_id == user.id)
    return statement


def lock_lab(db: Session, lab_id: int):
    # A write locks the row on PostgreSQL and serializes SQLite writes too.
    db.execute(update(Lab).where(Lab.id == lab_id).values(updated_at=utcnow()))


def assert_capacity(db: Session, lab: Lab):
    accepted = db.scalar(select(func.count()).select_from(Application).where(Application.lab_id == lab.id, Application.status == "accepted"))
    if accepted >= lab.capacity:
        raise HTTPException(409, "Phòng lab đã đủ số lượng sinh viên")


@router.get("")
def list_applications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(scoped_applications(user).options(selectinload(Application.student), selectinload(Application.lab), selectinload(Application.history), selectinload(Application.attachments).selectinload(ApplicationDocument.document)).order_by(Application.updated_at.desc())).all()
    return [application_json(row, user) for row in rows]


@router.post("", status_code=201)
def apply(data: ApplicationInput, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "student":
        raise HTTPException(403, "Chỉ sinh viên có thể nộp hồ sơ")
    lab = db.get(Lab, data.lab_id)
    if lab is None:
        raise HTTPException(404, "Không tìm thấy phòng lab")
    lock_lab(db, lab.id)
    db.refresh(lab)
    if not lab.is_open:
        raise HTTPException(409, "Phòng lab hiện tạm ngừng nhận hồ sơ")
    if lab.min_gpa > 0 and (user.gpa is None or user.gpa < lab.min_gpa):
        raise HTTPException(422, f"Hồ sơ cần GPA hệ 4 từ {lab.min_gpa:g}")
    assert_capacity(db, lab)
    duplicate = db.scalar(select(Application.id).where(Application.student_id == user.id, Application.lab_id == lab.id, Application.status.in_(ACTIVE_STATUSES)))
    if duplicate:
        raise HTTPException(409, "Bạn đã có hồ sơ đang được xử lý tại phòng lab này")
    application = Application(student_id=user.id, lab_id=lab.id, cover_letter=data.cover_letter)
    db.add(application)
    try:
        db.flush()
        db.add(ApplicationEvent(application_id=application.id, actor_id=user.id, from_status=None, to_status="submitted", note="Sinh viên nộp hồ sơ"))
        for document in db.scalars(select(Document).where(Document.user_id == user.id)).all():
            db.add(ApplicationDocument(application_id=application.id, document_id=document.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Bạn đã có hồ sơ đang được xử lý tại phòng lab này")
    return application_json(application, user)


@router.patch("/{application_id}/status")
def change_status(application_id: int, data: StatusInput, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    application = db.scalar(scoped_applications(user).where(Application.id == application_id))
    if application is None:
        raise HTTPException(404, "Không tìm thấy hồ sơ")
    lock_lab(db, application.lab_id)
    db.refresh(application)
    old_status = application.status
    if user.role == "student":
        allowed = data.status == "withdrawn" and old_status in {"submitted", "reviewing", "interview"}
    else:
        allowed = data.status in TRANSITIONS.get(old_status, set())
    if not allowed:
        raise HTTPException(409, f"Không thể chuyển từ {old_status} sang {data.status}")
    if data.status == "accepted":
        assert_capacity(db, application.lab)
    application.status = data.status
    application.updated_at = utcnow()
    if data.status == "withdrawn":
        db.execute(delete(ResearchChunk).where(ResearchChunk.user_id == application.student_id))
    db.add(ApplicationEvent(application_id=application.id, actor_id=user.id, from_status=old_status, to_status=data.status, note=data.note))
    db.commit()
    db.expire(application, ["history"])
    return application_json(application, user)
