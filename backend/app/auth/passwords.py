import asyncio

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.utils.rate_limit import FailureLimiter

_hasher = PasswordHasher()

join_limiter = FailureLimiter(max_failures=8, window_seconds=300)


async def hash_password(password: str) -> str:
    
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(stored_hash: str | None, password: str) -> bool:
    if not stored_hash:
        return False
    try:
        return await asyncio.to_thread(_hasher.verify, stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False