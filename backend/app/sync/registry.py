_channels: dict[str, set] = {}


def add(slug: str, channel) -> None:
    _channels.setdefault(slug, set()).add(channel)


def remove(slug: str, channel) -> None:
    bucket = _channels.get(slug)
    if bucket is None:
        return
    bucket.discard(channel)
    if not bucket:
        del _channels[slug]


async def kick_all(slug: str, code: int) -> None:
    """Disconnects everyone connected to a session."""
    for channel in list(_channels.get(slug, ())):
        await channel.close(code)