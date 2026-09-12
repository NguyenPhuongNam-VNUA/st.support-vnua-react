"""Contract and behavior tests for RESTful API endpoints.

Validates the resource-oriented architecture:
1. POST /api/v1/conversations/{id}/messages (201 Created in JSON mode, 200 OK in SSE mode)
2. GET  /api/v1/conversations/{id}/messages (200 OK message list)
3. DELETE /api/v1/conversations/{id} (204 No Content)
4. POST /api/v1/documents/{id}/embeddings (202 Accepted + Location header)
5. GET  /api/v1/jobs/{job_id} (200 OK or 404 Not Found)
6. GET  /api/v1/documents/{id}/chunks (200 OK)
"""

from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from core_ai.dependencies import register_component


class TestRestfulEndpoints:
    def test_create_message_json_mode(
        self, client: TestClient, mock_litellm_completion: AsyncMock
    ) -> None:
        """POST /api/v1/conversations/{id}/messages returns 201 Created with Location header in JSON mode."""
        headers = {
            "Authorization": "Bearer test-secret-token-123",
            "Accept": "application/json",
        }
        payload = {
            "message": "Học phí một tín chỉ ngành Công nghệ thông tin là bao nhiêu?",
        }
        response = client.post(
            "/api/v1/conversations/conv-1234/messages",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 201
        assert "Location" in response.headers
        assert response.headers["Location"] == "/api/v1/conversations/conv-1234/messages"
        data = response.json()
        assert "answer" in data
        assert data.get("status") in ("answered", "degraded", "blocked", "clarified", "escalated")

    def test_create_message_sse_mode(
        self, client: TestClient, mock_litellm_completion: AsyncMock
    ) -> None:
        """POST /api/v1/conversations/{id}/messages returns 200 OK with text/event-stream in SSE mode."""
        headers = {
            "Authorization": "Bearer test-secret-token-123",
            "Accept": "text/event-stream",
        }
        payload = {
            "message": "Quy chế đào tạo áp dụng cho sinh viên nào?",
        }
        response = client.post(
            "/api/v1/conversations/conv-1234/messages",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        assert "event: answer.completed" in response.text

    def test_get_conversation_messages(self, client: TestClient) -> None:
        """GET /api/v1/conversations/{id}/messages returns 200 OK with message list schema."""
        headers = {"Authorization": "Bearer test-secret-token-123"}
        response = client.get(
            "/api/v1/conversations/conv-test-99/messages",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_id"] == "conv-test-99"
        assert "messages" in data
        assert isinstance(data["messages"], list)

    def test_delete_conversation(self, client: TestClient) -> None:
        """DELETE /api/v1/conversations/{id} returns 204 No Content."""
        headers = {"Authorization": "Bearer test-secret-token-123"}
        response = client.delete(
            "/api/v1/conversations/conv-test-99",
            headers=headers,
        )
        assert response.status_code == 204
        assert response.text == ""

    def test_document_embedding_restful(self, client: TestClient) -> None:
        """POST /api/v1/documents/{id}/embeddings returns 202 Accepted with Location header."""
        mock_worker = MagicMock()
        mock_worker.process_document = AsyncMock()
        register_component("ingestion_worker", mock_worker)

        headers = {"Authorization": "Bearer test-secret-token-123"}
        payload = {"file_url": "https://supabase.co/storage/v1/object/signed/test.pdf"}

        response = client.post(
            "/api/v1/documents/42/embeddings",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 202
        assert "Location" in response.headers
        assert response.headers["Location"].startswith("/api/v1/jobs/job_embed_42_")
        data = response.json()
        assert data["status"] == "processing"
        assert data["document_id"] == 42
        assert "job_id" in data

    def test_document_embedding_legacy_bff_alias(self, client: TestClient) -> None:
        """The existing Next.js BFF path remains accepted."""
        mock_worker = MagicMock()
        mock_worker.process_document = AsyncMock()
        register_component("ingestion_worker", mock_worker)

        response = client.post(
            "/documents/embed",
            json={
                "document_id": 42,
                "file_url": "https://supabase.co/storage/v1/object/signed/test.pdf",
            },
            headers={"Authorization": "Bearer test-secret-token-123"},
        )

        assert response.status_code == 202
        assert response.json()["document_id"] == 42
        mock_worker.process_document.assert_awaited_once()

    def test_admin_markdown_reindex_uses_stored_content(self, client: TestClient) -> None:
        mock_worker = MagicMock()
        mock_worker.process_document = AsyncMock()
        register_component("ingestion_worker", mock_worker)

        response = client.post(
            "/documents/reindex-markdown",
            json={"document_id": 42},
            headers={"Authorization": "Bearer test-secret-token-123"},
        )

        assert response.status_code == 202
        assert response.json()["document_id"] == 42
        assert mock_worker.process_document.await_args.kwargs["use_stored_markdown"] is True
        assert mock_worker.process_document.await_args.kwargs["file_url"] == ""

    def test_get_job_status_success_and_not_found(self, client: TestClient) -> None:
        """GET /api/v1/jobs/{job_id} returns 200 OK for valid jobs and 404 for unknown jobs."""
        from core_ai.api.routes.jobs import register_job

        register_job("job_embed_99_testabc", document_id=99, tenant_id="vnua")

        headers = {"Authorization": "Bearer test-secret-token-123"}

        # 1. Existing job
        res_found = client.get("/api/v1/jobs/job_embed_99_testabc", headers=headers)
        assert res_found.status_code == 200
        job_data = res_found.json()
        assert job_data["job_id"] == "job_embed_99_testabc"
        assert job_data["status"] == "processing"

        # 2. Non-existent job
        res_missing = client.get("/api/v1/jobs/non_existent_job_12345", headers=headers)
        assert res_missing.status_code == 404

    def test_get_document_chunks_restful(self, client: TestClient) -> None:
        """GET /api/v1/documents/{id}/chunks returns 200 OK with chunk list schema."""
        headers = {"Authorization": "Bearer test-secret-token-123"}
        response = client.get("/api/v1/documents/101/chunks", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["document_id"] == 101
        assert "chunks" in data
        assert isinstance(data["chunks"], list)
