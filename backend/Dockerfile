FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first, so rebuilds are fast when only the code changes
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run as a normal user, not root
RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

# Railway provides PORT. 8000 is the default for local runs.
ENV PORT=8000
EXPOSE 8000

# ONE worker only. Rooms, rate limits and pending GitHub exports live in this process's memory.
# --proxy-headers makes the rate limits see each visitor's real address, not the proxy's.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]