from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import ResearchChunk, User
from app.schemas import ProfilePatch
from app.serializers import user_json

router = APIRouter(prefix="/api/profile", tags=["Profiles"])


@router.get("")
def profile(user: User = Depends(get_current_user)):
    return user_json(user)


@router.patch("")
def update_profile(data: ProfilePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fields = data.model_dump(exclude_unset=True)
    for key, value in fields.items():
        if value is None and key not in {"gpa", "year"}:
            raise HTTPException(422, f"{key} không được null")
        setattr(user, key, value)
    db.execute(delete(ResearchChunk).where(ResearchChunk.user_id == user.id))
    db.commit()
    return user_json(user)
