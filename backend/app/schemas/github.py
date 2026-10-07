import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

_SEGMENTS = re.compile(r"^[\w.\-]+(?:/[\w.\-]+)*$", re.ASCII)
_REPOSITORY = re.compile(r"^[A-Za-z0-9_.\-]{1,100}/[A-Za-z0-9_.\-]{1,100}$")
_FILENAME = re.compile(r"^[\w.\- ]{1,100}$", re.ASCII)


def _has_dot_segment(value: str) -> bool:
    return any(part in (".", "..") for part in value.split("/"))


class GistExport(BaseModel):
    kind: Literal["gist"]
    filename: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=200)
    public: bool = False

    @field_validator("filename")
    @classmethod
    def filename_is_safe(cls, value: str) -> str:
        value = value.strip()
        if not _FILENAME.match(value) or value in (".", ".."):
            raise ValueError("Use letters, numbers, spaces, dots, dashes and underscores only")
        return value


class RepoExport(BaseModel):
    kind: Literal["repo"]
    repository: str  # owner/name
    path: str = Field(min_length=1, max_length=200)
    branch: str | None = Field(default=None, max_length=100)
    message: str = Field(default="Export from Realtime Code Collaborator", min_length=1, max_length=200)
    include_private: bool = False

    @field_validator("repository")
    @classmethod
    def repository_is_safe(cls, value: str) -> str:
        value = value.strip()
        if not _REPOSITORY.match(value) or _has_dot_segment(value):
            raise ValueError("Use the format owner/repository")
        return value

    @field_validator("path")
    @classmethod
    def path_is_safe(cls, value: str) -> str:
        value = value.strip().lstrip("/")
        if not value or not _SEGMENTS.match(value) or _has_dot_segment(value):
            raise ValueError("Use a plain file path such as src/main.py")
        return value

    @field_validator("branch")
    @classmethod
    def branch_is_safe(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if value.startswith("-") or not _SEGMENTS.match(value) or _has_dot_segment(value):
            raise ValueError("Use a plain branch name such as main")
        return value


ExportRequest = Annotated[GistExport | RepoExport, Field(discriminator="kind")]


class StartResponse(BaseModel):
    authorize_url: str
    state: str


class FinishRequest(BaseModel):
    state: str = Field(min_length=20, max_length=200)
    finish_secret: str = Field(min_length=20, max_length=200)


class ExportResult(BaseModel):
    kind: Literal["gist", "repo"]
    url: str
    commit_url: str | None = None