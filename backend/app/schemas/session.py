from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_LANGUAGES = {
    "javascript", "typescript", "python", "java", "c", "cpp",
     "go", "rust", "php", "ruby",
}


class SessionCreate(BaseModel):
    title: str = Field(default="Untitled session", min_length=1, max_length=80)
    language: str = "javascript"

    @field_validator("language")
    @classmethod
    def language_supported(cls, value: str) -> str:
        if value not in ALLOWED_LANGUAGES:
            raise ValueError(f"Unsupported language: {value}")
        return value


class SessionCreated(BaseModel):
    slug: str
    title: str
    language: str
    owner_token: str 


class SessionPublic(BaseModel):
    slug: str
    title: str
    language: str
    guests_can_edit: bool
    is_persistent: bool
    has_password: bool  
    expires_at: datetime | None


class SessionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    password: str | None = Field(default=None, min_length=4, max_length=64)
    remove_password: bool = False
    expiry: Literal["never", "1h", "24h", "7d", "30d"] | None = None

    @model_validator(mode="after")
    def password_choice_is_clear(self):
        if self.password is not None and self.remove_password:
            raise ValueError("Send either password or remove_password, not both")
        return self


class PasswordCheck(BaseModel):
    password: str = Field(max_length=64)