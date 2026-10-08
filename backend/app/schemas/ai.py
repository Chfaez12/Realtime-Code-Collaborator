from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.session import ALLOWED_LANGUAGES


def _supported(value: str) -> str:
    if value not in ALLOWED_LANGUAGES:
        raise ValueError(f"Unsupported language: {value}")
    return value


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    language: str
    messages: list[ChatTurn] = Field(min_length=1, max_length=20)
    selection: str | None = Field(default=None, max_length=8000)
    selection_start_line: int | None = Field(default=None, ge=1)

    _language = field_validator("language")(_supported)

    @model_validator(mode="after")
    def conversation_shape(self):
        if self.messages[0].role != "user" or self.messages[-1].role != "user":
            raise ValueError("The conversation must start and end with a user message")
        return self


class ReviewRequest(BaseModel):
    language: str

    _language = field_validator("language")(_supported)


class Finding(BaseModel):
    line: int
    severity: Literal["error", "warning", "info"]
    title: str
    explanation: str
    suggestion: str = ""


class ReviewResponse(BaseModel):
    summary: str
    findings: list[Finding]
    truncated: bool = False


class CompleteRequest(BaseModel):
    language: str
    before: str = Field(max_length=6000)
    after: str = Field(default="", max_length=3000)

    _language = field_validator("language")(_supported)


class CompleteResponse(BaseModel):
    completion: str