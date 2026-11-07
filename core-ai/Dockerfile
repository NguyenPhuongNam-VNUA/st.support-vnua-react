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

# Copy package metadata plus a stub package for the build backend, so source edits
# keep this layer cached. The real code runs from /app/src via PYTHONPATH.
COPY pyproject.toml README.md ./
RUN mkdir -p src/core_ai && touch src/core_ai/__init__.py

# Install runtime dependencies and the optional local-model stack. The extra
# PyTorch index provides CPU-only wheels; PyPI remains available for its deps.
RUN pip install --upgrade pip setuptools wheel && \
    pip install --extra-index-url https://download.pytorch.org/whl/cpu ".[local-models]"

# ------------------------------------------------------------------------------
# Stage 2: Download local model weights (Prompt Guard + BGE reranker)
# ------------------------------------------------------------------------------
# HF_TOKEN must have access to the gated meta-llama/Llama-Prompt-Guard-2-86M repo.
# The token only lives in this stage; the runtime image copies the weights only.
FROM builder AS models
ARG HF_TOKEN
COPY scripts/download_local_models.py ./
RUN test -n "$HF_TOKEN" || (echo "ERROR: build arg HF_TOKEN is required to download models" && exit 1)
RUN HF_TOKEN="$HF_TOKEN" python download_local_models.py --output-dir /models

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime
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

ENV TOKENIZERS_PARALLELISM=false \
    OMP_NUM_THREADS=2

# Disable OpenSSL ARM CPU-feature probing: Docker Desktop on Apple M4 advertises
# SVE, and cryptography>=46 then crashes with SIGILL (exit 132). No-op on x86.
ENV OPENSSL_armcap=0

# Install runtime libraries (libpq for asyncpg/PostgreSQL, curl for health check probe)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    tesseract-ocr \
    tesseract-ocr-vie \
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

# Copy model weights after the chown so the ~3GB layer is not duplicated
COPY --from=models --chown=appuser:appgroup /models /app/models

# Switch to non-root user
USER appuser

# Expose microservice HTTP port
EXPOSE 5001

# Healthcheck includes mandatory database and embedding readiness.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health/ready', timeout=3)" || exit 1

# Launch production server via uvicorn. Railway injects PORT; Compose falls back to CORE_AI_PORT.
CMD ["sh", "-c", "exec uvicorn core_ai.main:app --host \"$CORE_AI_HOST\" --port \"${PORT:-$CORE_AI_PORT}\" --workers 1 --no-access-log"]
