import uuid

from app.sync import persistence


async def current_code(slug: str, session_id: uuid.UUID) -> str:
    """The code as it is right now: from the live room if people are connected, else the saved copy."""
    room = persistence.get_active_room(slug)
    if room is not None:
        return persistence.text_of_doc(room.ydoc)
    state = await persistence.load_state(session_id)
    return persistence.text_of_state(state) if state else ""