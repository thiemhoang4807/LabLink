import re
import secrets
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.auth import lecturer_required
from app.database import get_db
from app.models import Application, Lab, Publication, ResearchChunk, User
from app.routers.applications import lock_lab
from app.schemas import LabCreate, LabPatch, PublicationInput
from app.serializers import lab_json, publication_json

router = APIRouter(prefix="/api/labs", tags=["Labs"])


def get_lab(db: Session, lab_id: int) -> Lab:
    lab = db.get(Lab, lab_id)
    if lab is None:
        raise HTTPException(404, "Không tìm thấy phòng lab")
    return lab


def owned_lab(db: Session, lab_id: int, user: User) -> Lab:
    lab = get_lab(db, lab_id)
    if lab.owner_id != user.id:
        raise HTTPException(403, "Bạn chỉ có thể quản lý phòng lab của mình")
    return lab


@router.get("")
def list_labs(
    q: str = Query(default="", max_length=150),
    topic: str = Query(default="", max_length=80),
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    labs = db.scalars(select(Lab).options(selectinload(Lab.owner), selectinload(Lab.publications)).order_by(Lab.id)).all()
    q = q.casefold()
    filtered = [lab for lab in labs if (not q or q in " ".join([lab.name, lab.summary, lab.description, lab.owner.name, *lab.topics, *lab.skills]).casefold()) and (not topic or topic.casefold() in [t.casefold() for t in lab.topics])]
    if limit is not None:
        filtered = filtered[offset:offset + limit]
    elif offset:
        filtered = filtered[offset:]
    return [lab_json(lab) for lab in filtered]


@router.get("/{lab_id}")
def detail(lab_id: int, db: Session = Depends(get_db)):
    return lab_json(get_lab(db, lab_id), detail=True)


@router.post("", status_code=201)
def create_lab(data: LabCreate, user: User = Depends(lecturer_required), db: Session = Depends(get_db)):
    name_ascii = unicodedata.normalize("NFKD", data.name).encode("ascii", "ignore").decode().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", name_ascii).strip("-")[:150] or "lab"
    lab = Lab(owner_id=user.id, slug=f"{slug}-{secrets.token_hex(3)}", **data.model_dump())
    db.add(lab)
    db.commit()
    return lab_json(lab, detail=True)


@router.patch("/{lab_id}")
def update_lab(lab_id: int, data: LabPatch, user: User = Depends(lecturer_required), db: Session = Depends(get_db)):
    lab = owned_lab(db, lab_id, user)
    # Capacity edits must serialize with application acceptance on the same row.
    lock_lab(db, lab.id)
    db.refresh(lab)
    fields = data.model_dump(exclude_unset=True)
    if fields.get("capacity") is not None:
        accepted = db.scalar(select(func.count()).select_from(Application).where(Application.lab_id == lab.id, Application.status == "accepted"))
        if fields["capacity"] < accepted:
            raise HTTPException(409, f"Sức chứa không thể nhỏ hơn {accepted} sinh viên đã được chấp nhận")
    for key, value in fields.items():
        if value is None:
            raise HTTPException(422, f"{key} không được null")
        setattr(lab, key, value)
    db.execute(delete(ResearchChunk).where(ResearchChunk.lab_id == lab.id))
    db.commit()
    return lab_json(lab, detail=True)


@router.post("/{lab_id}/publications", status_code=201)
def add_publication(lab_id: int, data: PublicationInput, user: User = Depends(lecturer_required), db: Session = Depends(get_db)):
    lab = owned_lab(db, lab_id, user)
    from app.services.intelligence import classify_text
    classified = classify_text(data.title + " " + data.abstract)
    publication = Publication(lab_id=lab.id, **data.model_dump(), topics=classified["topics"], keywords=classified["keywords"])
    db.add(publication)
    db.execute(delete(ResearchChunk).where(ResearchChunk.lab_id == lab.id))
    db.commit()
    return publication_json(publication)
