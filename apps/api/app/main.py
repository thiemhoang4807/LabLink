from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import applications, auth, dashboard, documents, labs, profile


class BodyLimitMiddleware:
    """Also bound chunked uploads before multipart data reaches temporary storage."""
    def __init__(self, app, max_bytes):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        received = 0

        async def bounded_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise StarletteHTTPException(413, "Yêu cầu vượt quá giới hạn kích thước")
            return message

        await self.app(scope, bounded_receive, send)


def initialize_database():
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    if settings.seed_demo:
        if settings.app_env != "development":
            raise RuntimeError("SEED_DEMO chỉ được phép khi APP_ENV=development")
        from app.seed import seed_demo
        with SessionLocal() as db:
            seed_demo(db)


@asynccontextmanager
async def lifespan(_app):
    initialize_database()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="LabLink API", version="0.1.0", description="SEApp 2026 · Lab matching and recruitment MVP", lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.max_upload_bytes + 65536)

    @app.middleware("http")
    async def request_guard(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if request.headers.get("X-Requested-With") != "LabLink":
                return JSONResponse({"detail": "Thiếu tiêu đề bảo vệ yêu cầu X-Requested-With: LabLink"}, status_code=403)
            origin = request.headers.get("Origin")
            if origin and origin not in settings.frontend_origins:
                return JSONResponse({"detail": "Nguồn yêu cầu không được phép"}, status_code=403)
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > settings.max_upload_bytes + 65536:
                    return JSONResponse({"detail": "Yêu cầu vượt quá giới hạn kích thước"}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Content-Length không hợp lệ"}, status_code=400)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        return response

    app.add_middleware(CORSMiddleware, allow_origins=settings.frontend_origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
                       allow_headers=["Content-Type", "X-Requested-With"])
    for router in (auth.router, profile.router, labs.router, applications.router, documents.router, dashboard.router):
        app.include_router(router)
    from app.routers.intelligence import router as intelligence_router
    app.include_router(intelligence_router)

    @app.get("/api/health", tags=["Health"])
    def health():
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": engine.dialect.name, "version": "0.1.0"}

    return app


app = create_app()
