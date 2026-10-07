from typing import Literal

from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    language: str  
    code: str = Field(max_length=100_000)
    stdin: str = Field(max_length=10_000)


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int | None
    phase: Literal["compile", "run"]
    duration_ms: int