import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import create_session, get_current_user, hash_password, token_hash, verify_password
from app.config import settings
from app.database import get_db
from app.models import LoginSession, User
from app.schemas import LoginInput, RegisterInput
from app.serializers import user_json

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
_attempts = defaultdict(deque)
_lock = Lock()


def limit_auth(request: Request):
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _lock:
        if len(_attempts) > 10000:
            for address in list(_attempts):
                if not _attempts[address] or _attempts[address][-1] < now - 60:
                    del _attempts[address]
        if key not in _attempts and len(_attempts) >= 10000:
            raise HTTPException(429, "Hệ thống đang bận. Vui lòng thử lại sau.", headers={"Retry-After": "60"})
        entries = _attempts[key]
        while entries and entries[0] < now - 60:
            entries.popleft()
        if len(entries) >= 20:
            raise HTTPException(429, "Thử đăng nhập quá nhiều lần. Vui lòng chờ một phút.", headers={"Retry-After": "60"})
        entries.append(now)


@router.post("/login")
def login(data: LoginInput, request: Request, response: Response, db: Session = Depends(get_db)):
    limit_auth(request)
    user = db.scalar(select(User).where(User.email == data.email))
    # Run the expensive password derivation for unknown accounts as well.
    stored = user.password_hash if user else "scrypt$00000000000000000000000000000000$" + "0" * 128
    if not verify_password(data.password, stored) or user is None:
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    create_session(db, user, response, request)
    return {"user": user_json(user)}


@router.post("/register", status_code=201)
def register(data: RegisterInput, request: Request, response: Response, db: Session = Depends(get_db)):
    limit_auth(request)
    user = User(name=data.name, email=data.email, role=data.role, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email đã được đăng ký")
    create_session(db, user, response, request)
    return {"user": user_json(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": user_json(user)}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.cookie_name)
    if token:
        db.execute(delete(LoginSession).where(LoginSession.token_hash == token_hash(token)))
        db.commit()
    response.delete_cookie(settings.cookie_name, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")
    return {"message": "Đã đăng xuất"}
