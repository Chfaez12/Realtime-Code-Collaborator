import secrets
import string

_ALPHABET = string.ascii_letters + string.digits


def generate_slug(length: int = 10) -> str:
    """Random, URL-safe session id. Uses `secrets`, so it isn't guessable like `random`."""
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))