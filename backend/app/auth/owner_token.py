import hashlib
import hmac
import secrets


def generate_owner_token() -> str:
    return secrets.token_urlsafe(32)


def hash_owner_token(token: str) -> str:
    
    return hashlib.sha256(token.encode()).hexdigest()


def owner_token_matches(token: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    return hmac.compare_digest(hash_owner_token(token), stored_hash)