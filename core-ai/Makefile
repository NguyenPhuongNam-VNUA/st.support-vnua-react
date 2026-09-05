.PHONY: install install-models lint typecheck test test-integration compose health models anchors bm25

install:
	uv sync --extra dev --frozen

install-models:
	uv sync --extra dev --extra local-models --extra onnx-models --frozen

lint:
	uv run ruff check src tests scripts

typecheck:
	uv run mypy src

test:
	uv run pytest tests/unit tests/contract tests/security tests/retrieval tests/resilience tests/mcp -v

test-integration:
	uv run pytest tests/integration tests/e2e -v

compose:
	docker compose --profile monitoring up -d --build

health:
	powershell -Command "Invoke-RestMethod http://127.0.0.1:5001/health/ready"

health-mac:
	curl http://127.0.0.1:5001/health/ready

models:
	uv run python scripts/download_local_models.py

anchors:
	uv run python scripts/seed_topic_anchors.py --tenant vnua

bm25:
	uv run python scripts/build_bm25_index.py --tenant vnua
