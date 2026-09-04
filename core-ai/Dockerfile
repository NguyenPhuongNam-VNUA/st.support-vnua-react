# ==============================================================================
# ST-Care Core AI Microservice - Production Multi-Stage Dockerfile
# ==============================================================================
# Base Image: Python 3.11 Slim Debian Bookworm
# Security: Runs as non-root user (UID 10001), hardened, minimal image size.
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Dependencies
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS builder

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build tools required for compiling C-extensions (asyncpg, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy pyproject.toml to resolve and cache dependencies first
COPY pyproject.toml ./

# Install pip and wheel tools, then install project dependencies
RUN pip install --upgrade pip setuptools wheel && \
    pip install .

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="ST-Care Core AI" \
      org.opencontainers.image.description="RAG, LangGraph Orchestrator & LLM Gateway for VNUA" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.authors="ST-Care Team <dev@vnua.edu.vn>"

# Security & runtime environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app/src" \
    PATH="/opt/venv/bin:$PATH" \
    APP_ENV="production" \
    CORE_AI_HOST="0.0.0.0" \
    CORE_AI_PORT="5001"

# Install runtime libraries (libpq for asyncpg/PostgreSQL, curl for health check probe)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-privileged service user and group
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -d /app appuser

WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy application source code and configurations
COPY src/ /app/src/
COPY pyproject.toml /app/pyproject.toml

# Set directory ownership to non-root appuser
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose microservice HTTP port
EXPOSE 5001

# Healthcheck probe querying FastAPI /health/live endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health/live', timeout=3)" || exit 1

# Launch production server via uvicorn
CMD ["uvicorn", "core_ai.main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "2", "--no-access-log"]
