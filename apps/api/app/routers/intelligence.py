"""AI endpoints keep authorization in SQL and external-provider use opt-in."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, lecturer_required
from app.database import get_db
from app.models import Lab, Publication, ResearchChunk, User
from app.services.intelligence import (
    CrawlError,
    answer_query,
    classify_text,
    preview_research_import,
    profile_lab_match,
    validate_crawl_url,
)

router = APIRouter(prefix="/api/ai", tags=["intelligence"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    # Accepted for UI compatibility; not persisted, indexed, or sent externally.
    history: list[dict] = Field(default_factory=list, max_length=20)


class ClassificationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class ImportRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2000)
    lab_id: int = Field(gt=0)


class ConfirmImportRequest(BaseModel):
    lab_id: int = Field(gt=0)
    source_url: str = Field(min_length=8, max_length=2000)
    title: str = Field(min_length=3, max_length=500)
    abstract: str = Field(default="", max_length=20000)
    year: int | None = Field(default=None, ge=1900, le=2100)


def _owned_lab(db: Session, lab_id: int, actor: User) -> Lab:
    lab = db.scalar(select(Lab).where(Lab.id == lab_id, Lab.owner_id == actor.id))
    if lab is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lab thuộc quyền quản lý của bạn.")
    return lab


@router.post("/chat")
def chat(payload: ChatRequest, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Vui lòng nhập câu hỏi.")
    return answer_query(db, actor, payload.message)


@router.get("/matches")
def matches(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != "student":
        raise HTTPException(status_code=403, detail="Gợi ý lab dành cho tài khoản sinh viên.")
    labs = db.scalars(select(Lab).where(Lab.is_open.is_(True))).all()
    result = [profile_lab_match(actor, lab) for lab in labs]
    return sorted(result, key=lambda item: (-item["score"], item["lab_id"]))


@router.post("/classify")
def classify(payload: ClassificationRequest, actor: User = Depends(get_current_user)):
    # Deterministic local taxonomy, including when external AI is configured.
    return classify_text(payload.text)


@router.post("/import")
def import_preview(payload: ImportRequest, db: Session = Depends(get_db), actor: User = Depends(lecturer_required)):
    _owned_lab(db, payload.lab_id, actor)
    try:
        return preview_research_import(payload.url)
    except CrawlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/import/confirm", status_code=201)
def confirm_import(payload: ConfirmImportRequest, db: Session = Depends(get_db), actor: User = Depends(lecturer_required)):
    _owned_lab(db, payload.lab_id, actor)
    if not payload.title.strip():
        raise HTTPException(status_code=422, detail="Tên bài báo không được trống.")
    if payload.year and payload.year > datetime.now(timezone.utc).year + 1:
        raise HTTPException(status_code=422, detail="Năm xuất bản vượt quá năm tới.")
    try:
        # Confirmation performs no network fetch, but retains the URL allowlist.
        source_url, _ = validate_crawl_url(payload.source_url, resolve=False)
    except CrawlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    existing = db.scalar(select(Publication).where(Publication.lab_id == payload.lab_id, Publication.url == source_url, Publication.title == payload.title.strip()))
    if existing:
        raise HTTPException(status_code=409, detail="Bài báo này đã được lưu cho lab.")
    classified = classify_text(payload.title + " " + payload.abstract)
    publication = Publication(lab_id=payload.lab_id, title=payload.title.strip(), abstract=payload.abstract.strip(), url=source_url, year=payload.year, source="university_import_confirmed", topics=classified["topics"], keywords=classified["keywords"])
    db.add(publication)
    # Public research changed: refresh the aggregate lab chunks on next query.
    for chunk in db.scalars(select(ResearchChunk).where(ResearchChunk.lab_id == payload.lab_id)).all():
        db.delete(chunk)
    db.commit()
    db.refresh(publication)
    return {"id": publication.id, "lab_id": publication.lab_id, "title": publication.title, "abstract": publication.abstract, "url": publication.url, "year": publication.year, "source": publication.source, "topics": publication.topics, "keywords": publication.keywords}
