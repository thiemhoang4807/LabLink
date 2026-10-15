import re
import secrets
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Application, ApplicationDocument, Document, Lab, ResearchChunk, User
from app.serializers import document_json
from app.services.documents import extract_pdf_text

router = APIRouter(prefix="/api/documents", tags=["Private documents"])


def storage_path(document: Document) -> Path:
    root = settings.storage_dir.resolve()
    path = (root / document.storage_key).resolve()
    if path.parent != root:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    return path


@router.post("", status_code=201)
def upload_document(kind: Literal["cv", "transcript"] = Form(...), file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "student":
        raise HTTPException(403, "Chỉ sinh viên có thể tải tài liệu hồ sơ")
    existing = db.scalars(select(Document.id).where(Document.user_id == user.id)).all()
    if len(existing) >= 10:
        raise HTTPException(422, "Mỗi hồ sơ tối đa 10 tài liệu. Vui lòng xóa tài liệu cũ.")
    raw_name = (file.filename or "document.pdf").replace("\\", "/").split("/")[-1]
    filename = re.sub(r"[\x00-\x1f\x7f]", "", raw_name)[:195]
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(422, "Chỉ chấp nhận tài liệu PDF")
    data = file.file.read(settings.max_upload_bytes + 1)
    file.file.close()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "Tài liệu tối đa 5 MB")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(422, "Nội dung không phải PDF hợp lệ")
    try:
        extracted_text = extract_pdf_text(data)
    except ValueError as error:
        raise HTTPException(422, str(error))
    storage_key = secrets.token_hex(24) + ".pdf"
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    path = settings.storage_dir / storage_key
    document = Document(user_id=user.id, kind=kind, filename=filename, storage_key=storage_key,
                        size_bytes=len(data), extracted_text=extracted_text)
    try:
        path.write_bytes(data)
        db.add(document)
        db.commit()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return document_json(document)


@router.get("/{document_id}/download")
def download_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    permitted = document.user_id == user.id
    if user.role == "lecturer":
        permitted = db.scalar(select(ApplicationDocument.application_id).join(Application, Application.id == ApplicationDocument.application_id).join(Lab, Lab.id == Application.lab_id).where(ApplicationDocument.document_id == document.id, Lab.owner_id == user.id, Application.status != "withdrawn").limit(1)) is not None
    if not permitted:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    path = storage_path(document)
    if not path.is_file():
        raise HTTPException(404, "Không tìm thấy tệp tài liệu")
    return FileResponse(path, media_type="application/pdf", filename=document.filename,
                        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}, content_disposition_type="attachment")


@router.delete("/{document_id}")
def delete_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user.id))
    if document is None:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    path = storage_path(document)
    db.execute(delete(ApplicationDocument).where(ApplicationDocument.document_id == document.id))
    db.execute(delete(ResearchChunk).where(ResearchChunk.user_id == user.id))
    db.delete(document)
    db.commit()
    path.unlink(missing_ok=True)
    return {"message": "Đã xóa tài liệu"}
