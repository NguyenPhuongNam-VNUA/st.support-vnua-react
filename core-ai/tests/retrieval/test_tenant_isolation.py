"""Retrieval Tests for Tenant Isolation and Access Control.

Tests:
1. Application-level tenant validation: rejecting unauthorized/unknown tenants immediately.
2. Vector search rejects unapproved tenants without querying the database.
3. BM25 full-text search rejects unapproved tenants without querying the database.
4. Allowed tenants proceed safely to query execution.
"""

from unittest.mock import AsyncMock, patch

import pytest

from core_ai.config import Settings
from core_ai.data.repositories.document_repo import DocumentRepository


@pytest.fixture
def repo(mock_settings: Settings) -> DocumentRepository:
    return DocumentRepository(settings=mock_settings)


class TestTenantIsolation:
    def test_tenant_allowed_policy(self, repo: DocumentRepository) -> None:
        """Only tenants in settings.allowed_tenants or default_tenant evaluate to True."""
        assert repo.is_tenant_allowed("vnua") is True
        assert repo.is_tenant_allowed("test_tenant") is True
        assert repo.is_tenant_allowed("foreign_univ") is False
        assert repo.is_tenant_allowed("evil_hacker") is False

    @pytest.mark.asyncio
    async def test_vector_search_denies_unauthorized_tenant(
        self, repo: DocumentRepository
    ) -> None:
        """Unauthorized tenant yields an empty list without executing SQL."""
        embedding = [0.1] * 1024
        with patch("core_ai.data.repositories.document_repo.get_db_connection") as mock_conn:
            res = await repo.search_chunks_by_vector(
                query_embedding=embedding,
                tenant_id="unauthorized_tenant",
            )
            assert res == []
            mock_conn.assert_not_called()

    @pytest.mark.asyncio
    async def test_bm25_search_denies_unauthorized_tenant(
        self, repo: DocumentRepository
    ) -> None:
        """Unauthorized tenant yields empty list for BM25 search without executing SQL."""
        with patch("core_ai.data.repositories.document_repo.get_db_connection") as mock_conn:
            # Pass query_text
            res = await repo.search_chunks_by_bm25(
                query_text="học phí",
                tenant_id="unauthorized_tenant",
            )
            assert res == []
            mock_conn.assert_not_called()

            # Also verify query_terms if supported
            try:
                res_terms = await repo.search_chunks_by_bm25(
                    query_terms=["học", "phí"],
                    tenant_id="unauthorized_tenant",
                )
                assert res_terms == []
                mock_conn.assert_not_called()
            except TypeError:
                pass

    @pytest.mark.asyncio
    async def test_authorized_tenant_executes_query(
        self, repo: DocumentRepository, mock_db_conn: AsyncMock
    ) -> None:
        """Authorized tenant 'vnua' proceeds to query execution."""
        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def mock_get_conn(*args, **kwargs):
            yield mock_db_conn

        with patch("core_ai.data.repositories.document_repo.get_db_connection", mock_get_conn):
            res = await repo.search_chunks_by_vector(
                query_embedding=[0.05] * 1024,
                tenant_id="vnua",
                top_k=2,
            )
            assert len(res) == 2
            assert res[0].document_id == 101
