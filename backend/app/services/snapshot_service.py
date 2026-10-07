import uuid

from pycrdt import Doc, Text

from app.sync import persistence


async def current_state(slug: str, session_id: uuid.UUID) -> bytes:
    """The latest document state: from the live room if there is one, else from the database."""
    room = persistence.get_active_room(slug)
    if room is not None:
        return room.ydoc.get_update()
    saved = await persistence.load_state(session_id)
    return saved or Doc().get_update()


def _replace_text(doc: Doc, content: str) -> None:
    text = doc.get("monaco", type=Text)
    with doc.transaction():
        length = len(text)
        if length:
            del text[0:length]
        if content:
            text.insert(0, content)


async def restore_content(slug: str, session_id: uuid.UUID, content: str) -> None:
    room = persistence.get_active_room(slug)
    if room is not None:
        _replace_text(room.ydoc, content)
        return

    state = await persistence.load_state(session_id)
    doc = Doc()
    if state:
        doc.apply_update(state)
    _replace_text(doc, content)
    await persistence.save_state(session_id, doc.get_update())