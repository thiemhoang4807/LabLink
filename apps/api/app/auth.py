import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import LoginSession, User


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt, expected = stored.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=64)
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, response: Response, request: Request):
    # Rotate an existing browser session on each authentication event.
    old_token = request.cookies.get(settings.cookie_name)
    if old_token:
        db.execute(delete(LoginSession).where(LoginSession.token_hash == token_hash(old_token)))
    now = datetime.now(timezone.utc)
    db.execute(delete(LoginSession).where(LoginSession.expires_at <= now))
    token = secrets.token_urlsafe(48)
    db.add(LoginSession(token_hash=token_hash(token), user_id=user.id, expires_at=now + timedelta(hours=settings.session_hours)))
    db.commit()
    response.set_cookie(settings.cookie_name, token, httponly=True, secure=settings.cookie_secure,
                        samesite="lax", max_age=settings.session_hours * 3600, path="/")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.cookie_name)
    if not token or len(token) > 128:
        raise HTTPException(401, "Vui lòng đăng nhập")
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == token_hash(token)))
    if session is None:
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ")
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(401, "Phiên đăng nhập đã hết hạn")
    return session.user


def lecturer_required(user: User = Depends(get_current_user)) -> User:
    if user.role != "lecturer":
        raise HTTPException(403, "Chỉ giảng viên có quyền thực hiện thao tác này")
    return user
