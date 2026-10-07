from pycrdt import Doc, Map, Text
import json
MSG_SYNC = 0
MSG_OWNER_AUTH = 100  # our own message type; the standard Yjs ones are 0-3

_SYNC_STEP2 = 1
_SYNC_UPDATE = 2


def _read_var_uint(data: bytes, pos: int) -> tuple[int, int]:
    """Reads a lib0 variable-length unsigned integer. Returns (value, next_position)."""
    result = 0
    shift = 0
    while True:
        if pos >= len(data):
            raise ValueError("truncated message")
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        if byte < 0x80:
            return result, pos
        shift += 7
        if shift > 35:
            raise ValueError("varint too long")


def parse_auth_string(message: bytes) -> str | None:
    try:
        length, pos = _read_var_uint(message, 1)
        if pos + length > len(message):
            return None
        return message[pos : pos + length].decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None

MSG_IDENTITY = 102 

def parse_identity(message: bytes) -> dict | None:
    raw = parse_auth_string(message)
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None

    name = data.get("name")
    clean_name = None
    if isinstance(name, str):
        cleaned = "".join(ch for ch in name if ch.isprintable()).strip()[:40]
        clean_name = cleaned or None

    token = data.get("token")
    return {
        "name": clean_name,
        "token": token if isinstance(token, str) and 0 < len(token) <= 4096 else None,
    }


def extract_update(message: bytes) -> bytes | None:
    """For sync messages that carry document changes (step 2 or update), returns the
    update bytes. Returns None for messages that change nothing (e.g. step 1, which is
    just a request for the current state). Raises ValueError if the message is malformed."""
    if len(message) < 2 or message[1] not in (_SYNC_STEP2, _SYNC_UPDATE):
        return None
    length, pos = _read_var_uint(message, 2)
    if pos + length > len(message):
        raise ValueError("update longer than message")
    return message[pos : pos + length]


def room_allows_guest_edits(room) -> bool:
    """Reads settings.canEdit from the room's document. Missing means editable."""
    settings = room.ydoc.get("settings", type=Map)
    return (settings.to_py() or {}).get("canEdit") is not False


def update_touches_protected(room, update: bytes) -> bool:
    """True if applying `update` would change the code text or the settings map.
    It is tested on a scratch copy, so the real room is never touched."""
    scratch = Doc()
    scratch.apply_update(room.ydoc.get_update())
    text = scratch.get("monaco", type=Text)
    settings = scratch.get("settings", type=Map)

    before = (str(text), settings.to_py())
    scratch.apply_update(update)
    after = (str(text), settings.to_py())
    return before != after

MSG_SYNC = 0
MSG_OWNER_AUTH = 100  # our own message types; the standard Yjs ones are 0-3
MSG_PASSWORD = 101


def parse_auth_string(message: bytes) -> str | None:
    try:
        length, pos = _read_var_uint(message, 1)
        if pos + length > len(message):
            return None
        return message[pos : pos + length].decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None