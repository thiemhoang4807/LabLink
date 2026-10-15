from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Application, Lab, User
from app.routers.applications import scoped_applications

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    applications = db.scalars(scoped_applications(user)).all()
    counts = Counter(a.status for a in applications)
    labs = db.scalar(select(func.count()).select_from(Lab).where(Lab.is_open.is_(True)))
    owned = db.scalar(select(func.count()).select_from(Lab).where(Lab.owner_id == user.id)) if user.role == "lecturer" else 0
    return {"role": user.role, "total_applications": len(applications), "open_labs": labs,
            "owned_labs": owned, "by_status": {s: counts[s] for s in ("submitted", "reviewing", "interview", "accepted", "rejected", "withdrawn")},
            "pending": counts["submitted"] + counts["reviewing"], "interviews": counts["interview"], "accepted": counts["accepted"]}
