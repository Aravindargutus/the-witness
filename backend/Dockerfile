FROM python:3.12-slim

WORKDIR /app

# Build context is the-witness/ (one level above backend/)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy witness prompts into a known location
COPY agents/prompts/ /app/prompts/

# Run as non-root user for security
RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser /app
USER appuser

EXPOSE 8080

ENV PROMPTS_DIR=/app/prompts

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --loop uvloop"]
