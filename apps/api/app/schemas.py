import re
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LoginInput(InputModel):
    # Passwords are exact secrets; whitespace normalization applies to names/email only.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email không hợp lệ")
        return value


class RegisterInput(LoginInput):
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=10, max_length=128)
    role: Literal["student", "lecturer"] = "student"

    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return value.strip() if isinstance(value, str) else value


def clean_tags(value):
    if value is None:
        raise ValueError("Danh sách không được null")
    if len(value) > 30:
        raise ValueError("Tối đa 30 mục")
    output = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item.strip()) > 80:
            raise ValueError("Mỗi mục cần từ 1 đến 80 ký tự")
        item = item.strip()
        if item.casefold() not in [v.casefold() for v in output]:
            output.append(item)
    return output


def valid_url(value):
    if value and (urlsplit(value).scheme not in {"http", "https"} or not urlsplit(value).hostname):
        raise ValueError("Đường dẫn phải là HTTP hoặc HTTPS")
    return value


class ProfilePatch(InputModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    bio: str | None = Field(default=None, max_length=4000)
    gpa: float | None = Field(default=None, ge=0, le=4)
    skills: list[str] | None = None
    interests: list[str] | None = None
    major: str | None = Field(default=None, max_length=160)
    year: int | None = Field(default=None, ge=1, le=8)
    university: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    consent_ai: bool | None = None

    @field_validator("skills", "interests")
    @classmethod
    def tags(cls, value):
        return clean_tags(value)

    @field_validator("website")
    @classmethod
    def website_url(cls, value):
        return valid_url(value)


class LabCreate(InputModel):
    name: str = Field(min_length=3, max_length=160)
    summary: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=12000)
    topics: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    min_gpa: float = Field(default=0, ge=0, le=4)
    capacity: int = Field(default=5, ge=1, le=100)
    location: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=500)
    is_open: bool = True

    @field_validator("topics", "skills")
    @classmethod
    def tags(cls, value):
        return clean_tags(value)

    @field_validator("website")
    @classmethod
    def website_url(cls, value):
        return valid_url(value)


class LabPatch(InputModel):
    name: str | None = Field(default=None, min_length=3, max_length=160)
    summary: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=12000)
    topics: list[str] | None = None
    skills: list[str] | None = None
    min_gpa: float | None = Field(default=None, ge=0, le=4)
    capacity: int | None = Field(default=None, ge=1, le=100)
    location: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    is_open: bool | None = None

    @field_validator("topics", "skills")
    @classmethod
    def tags(cls, value):
        return clean_tags(value)

    @field_validator("website")
    @classmethod
    def website_url(cls, value):
        return valid_url(value)


class PublicationInput(InputModel):
    title: str = Field(min_length=3, max_length=500)
    abstract: str = Field(default="", max_length=12000)
    url: str = Field(default="", max_length=1000)
    year: int | None = Field(default=None, ge=1950, le=2100)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        return valid_url(value)


class ApplicationInput(InputModel):
    lab_id: int = Field(gt=0)
    cover_letter: str = Field(min_length=20, max_length=8000)


class StatusInput(InputModel):
    status: Literal["submitted", "reviewing", "interview", "accepted", "rejected", "withdrawn"]
    note: str = Field(default="", max_length=2000)
