"""Configuration settings for ST-Care Core AI microservice.

Uses Pydantic Settings to load and validate environment variables with secure defaults.
"""

from functools import lru_cache
from typing import List, Optional, Union
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application Environment
    app_env: str = Field(default="development", alias="APP_ENV")
    core_ai_host: str = Field(default="0.0.0.0", alias="CORE_AI_HOST")
    core_ai_port: int = Field(default=5001, alias="CORE_AI_PORT")

    # Security & Auth (Dual alias for compatibility with Next.js BFF)
    internal_service_token: str = Field(
        default="",
        validation_alias=AliasChoices("INTERNAL_SERVICE_TOKEN", "AI_AGENT_SERVICE_TOKEN"),
        description="Shared secret Bearer token for inter-service communication",
    )

    # Multi-Tenant Isolation
    default_tenant: str = Field(default="vnua", alias="DEFAULT_TENANT")
    allowed_tenants: Union[List[str], str] = Field(
        default=["vnua"],
        alias="ALLOWED_TENANTS",
    )

    # LLM Gateway
    llm_provider: str = Field(default="gemini", alias="LLM_PROVIDER")
    llm_model: str = Field(default="gemini-3.5-flash", alias="LLM_MODEL")
    llm_api_key: Optional[str] = Field(default=None, alias="LLM_API_KEY")
    llm_base_url: Optional[str] = Field(default=None, alias="LLM_BASE_URL")
    llm_timeout_seconds: float = Field(default=20.0, alias="LLM_TIMEOUT_SECONDS")
    llm_max_external_calls: int = Field(default=2, alias="LLM_MAX_EXTERNAL_CALLS")
    llm_fallback_provider: Optional[str] = Field(default=None, alias="LLM_FALLBACK_PROVIDER")
    llm_fallback_model: Optional[str] = Field(default=None, alias="LLM_FALLBACK_MODEL")

    # Gemini Embedding 2 (1024d retained for the existing pgvector schema)
    embedding_provider: str = Field(default="gemini", alias="EMBEDDING_PROVIDER")
    embedding_model: str = Field(
        default="gemini-embedding-2",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "GEMINI_EMBEDDING_MODEL"),
    )
    embedding_dimension: int = Field(default=1024, alias="EMBEDDING_DIMENSION")
    embedding_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "EMBEDDING_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"
        ),
    )
    embedding_base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        alias="EMBEDDING_BASE_URL",
    )
    embedding_timeout_seconds: float = Field(default=20.0, alias="EMBEDDING_TIMEOUT_SECONDS")
    embedding_max_concurrency: int = Field(default=5, alias="EMBEDDING_MAX_CONCURRENCY")

    # PostgreSQL & Supavisor Pooler Configuration
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:6543/postgres",
        alias="DATABASE_URL",
    )
    db_pool_min_size: int = Field(default=2, alias="DB_POOL_MIN_SIZE")
    db_pool_max_size: int = Field(default=10, alias="DB_POOL_MAX_SIZE")
    db_command_timeout_seconds: float = Field(default=3.0, alias="DB_COMMAND_TIMEOUT_SECONDS")
    db_statement_cache_size: int = Field(
        default=0,
        alias="DB_STATEMENT_CACHE_SIZE",
        description="Must be 0 for Supavisor transaction pooler compatibility",
    )

    # Redis Semantic Cache
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    redis_max_connections: int = Field(default=30, alias="REDIS_MAX_CONNECTIONS")

    # MCP Gateway Configuration
    mcp_transport: str = Field(default="streamable-http", alias="MCP_TRANSPORT")
    mcp_tool_timeout_seconds: float = Field(default=3.0, alias="MCP_TOOL_TIMEOUT_SECONDS")
    mcp_allowed_tools: Union[List[str], str] = Field(
        default=[
            "search_knowledge",
            "lookup_schedule",
            "check_tuition",
            "get_regulations",
            "create_support_case",
        ],
        alias="MCP_ALLOWED_TOOLS",
    )

    # Observability & Logging
    otel_service_name: str = Field(default="st-care-core-ai", alias="OTEL_SERVICE_NAME")
    otel_exporter_otlp_endpoint: Optional[str] = Field(
        default=None, alias="OTEL_EXPORTER_OTLP_ENDPOINT"
    )
    log_raw_prompts: bool = Field(default=False, alias="LOG_RAW_PROMPTS")

    @field_validator("allowed_tenants", mode="before")
    @classmethod
    def parse_allowed_tenants(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return v

    @field_validator("mcp_allowed_tools", mode="before")
    @classmethod
    def parse_mcp_allowed_tools(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Returns singleton cached instance of Application Settings."""
    return Settings()
