from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('student', 'lecturer')", name="ck_user_role"), CheckConstraint("gpa IS NULL OR (gpa >= 0 AND gpa <= 4)", name="ck_gpa"))
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(20))
    bio: Mapped[str] = mapped_column(Text, default="")
    gpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    interests: Mapped[list] = mapped_column(JSON, default=list)
    major: Mapped[str] = mapped_column(String(160), default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    university: Mapped[str] = mapped_column(String(200), default="")
    website: Mapped[str] = mapped_column(String(500), default="")
    consent_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    documents: Mapped[list["Document"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class LoginSession(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship()


class Lab(Base):
    __tablename__ = "labs"
    __table_args__ = (CheckConstraint("capacity >= 1 AND capacity <= 100", name="ck_capacity"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    summary: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    topics: Mapped[list] = mapped_column(JSON, default=list)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    min_gpa: Mapped[float] = mapped_column(Float, default=0)
    capacity: Mapped[int] = mapped_column(Integer, default=5)
    location: Mapped[str] = mapped_column(String(200), default="")
    website: Mapped[str] = mapped_column(String(500), default="")
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    owner: Mapped[User] = relationship()
    publications: Mapped[list["Publication"]] = relationship(back_populates="lab", cascade="all, delete-orphan")


class Publication(Base):
    __tablename__ = "publications"
    id: Mapped[int] = mapped_column(primary_key=True)
    lab_id: Mapped[int] = mapped_column(ForeignKey("labs.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    abstract: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(1000), default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="manual")
    topics: Mapped[list] = mapped_column(JSON, default=list)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    lab: Mapped[Lab] = relationship(back_populates="publications")


ACTIVE_STATUSES = ("submitted", "reviewing", "interview", "accepted")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint("status IN ('submitted','reviewing','interview','accepted','rejected','withdrawn')", name="ck_application_status"),
        Index("uq_active_application", "student_id", "lab_id", unique=True,
              sqlite_where=text("status IN ('submitted','reviewing','interview','accepted')"),
              postgresql_where=text("status IN ('submitted','reviewing','interview','accepted')")),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lab_id: Mapped[int] = mapped_column(ForeignKey("labs.id"), index=True)
    cover_letter: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="submitted", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    student: Mapped[User] = relationship()
    lab: Mapped[Lab] = relationship()
    history: Mapped[list["ApplicationEvent"]] = relationship(back_populates="application", cascade="all, delete-orphan", order_by="ApplicationEvent.created_at")
    attachments: Mapped[list["ApplicationDocument"]] = relationship(cascade="all, delete-orphan")


class ApplicationEvent(Base):
    __tablename__ = "application_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    application: Mapped[Application] = relationship(back_populates="history")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (CheckConstraint("kind IN ('cv','transcript')", name="ck_document_kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    filename: Mapped[str] = mapped_column(String(200))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="documents")


class ApplicationDocument(Base):
    __tablename__ = "application_documents"
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    document: Mapped[Document] = relationship()


class ResearchChunk(Base):
    __tablename__ = "research_chunks"
    __table_args__ = (Index("ix_chunk_source", "source_type", "source_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list] = mapped_column(JSON, default=list)
    embedding_vector: Mapped[list | None] = mapped_column(Vector(256).with_variant(JSON(), "sqlite"), nullable=True)
    source_type: Mapped[str] = mapped_column(String(40))
    source_id: Mapped[int] = mapped_column(Integer)
    lab_id: Mapped[int | None] = mapped_column(ForeignKey("labs.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
