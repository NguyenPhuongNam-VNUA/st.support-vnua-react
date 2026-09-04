"""Configuration settings for ST-Care Core AI microservice.

Uses Pydantic Settings to load and validate environment variables with secure defaults.
"""

from functools import lru_cache
from typing import List, Optional, Union
from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # Application Environment
    app_env: str = Field(default="development", alias="APP_ENV")
    core_ai_host: str = Field(default="0.0.0.0", alias="CORE_AI_HOST")
    core_ai_port: int = Field(default=5001, ge=1, le=65535, alias="CORE_AI_PORT")
    max_request_body_bytes: int = Field(
        default=1_048_576, ge=1024, le=10_485_760, alias="MAX_REQUEST_BODY_BYTES"
    )
    request_deadline_seconds: float = Field(
        default=30.0, ge=2.0, le=120.0, alias="REQUEST_DEADLINE_SECONDS"
    )

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
    llm_timeout_seconds: float = Field(default=20.0, ge=1.0, le=60.0, alias="LLM_TIMEOUT_SECONDS")
    llm_max_external_calls: int = Field(default=2, ge=1, le=2, alias="LLM_MAX_EXTERNAL_CALLS")
    llm_fallback_provider: Optional[str] = Field(default=None, alias="LLM_FALLBACK_PROVIDER")
    llm_fallback_model: Optional[str] = Field(default=None, alias="LLM_FALLBACK_MODEL")

    # Gemini Embedding 2 (1024d retained for the existing pgvector schema)
    embedding_provider: str = Field(default="gemini", alias="EMBEDDING_PROVIDER")
    embedding_model: str = Field(
        default="gemini-embedding-2",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "GEMINI_EMBEDDING_MODEL"),
    )
    embedding_dimension: int = Field(default=1024, ge=128, le=3072, alias="EMBEDDING_DIMENSION")
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
    embedding_timeout_seconds: float = Field(default=20.0, ge=1.0, le=60.0, alias="EMBEDDING_TIMEOUT_SECONDS")
    embedding_max_concurrency: int = Field(default=5, ge=1, le=20, alias="EMBEDDING_MAX_CONCURRENCY")
    reranker_timeout_seconds: float = Field(
        default=1.5, ge=0.05, le=10.0, alias="RERANKER_TIMEOUT_SECONDS"
    )
    retrieval_top_k: int = Field(default=3, ge=1, le=5, alias="RETRIEVAL_TOP_K")

    # Optional local safety/reranking models. Runtime never downloads weights.
    local_models_enabled: bool = Field(default=True, alias="LOCAL_MODELS_ENABLED")
    local_models_device: str = Field(default="cpu", alias="LOCAL_MODELS_DEVICE")
    prompt_guard_model_path: str = Field(
        default="./models/Llama-Prompt-Guard-2-86M", alias="PROMPT_GUARD_MODEL_PATH"
    )
    prompt_guard_threshold: float = Field(
        default=0.80, ge=0.0, le=1.0, alias="PROMPT_GUARD_THRESHOLD"
    )
    prompt_guard_timeout_seconds: float = Field(
        default=0.8, ge=0.05, le=5.0, alias="PROMPT_GUARD_TIMEOUT_SECONDS"
    )
    bge_reranker_model_path: str = Field(
        default="./models/bge-reranker-v2-m3", alias="BGE_RERANKER_MODEL_PATH"
    )

    # PostgreSQL & Supavisor Pooler Configuration
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:6543/postgres",
        alias="DATABASE_URL",
    )
    db_pool_min_size: int = Field(default=2, ge=1, le=50, alias="DB_POOL_MIN_SIZE")
    db_pool_max_size: int = Field(default=10, ge=1, le=100, alias="DB_POOL_MAX_SIZE")
    db_command_timeout_seconds: float = Field(default=3.0, alias="DB_COMMAND_TIMEOUT_SECONDS")
    db_statement_cache_size: int = Field(
        default=0,
        alias="DB_STATEMENT_CACHE_SIZE",
        description="Must be 0 for Supavisor transaction pooler compatibility",
    )

    # Redis Semantic Cache
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    redis_max_connections: int = Field(default=30, alias="REDIS_MAX_CONNECTIONS")
    rate_limit_per_minute: int = Field(default=60, ge=1, le=10000, alias="RATE_LIMIT_PER_MINUTE")
    idempotency_ttl_seconds: int = Field(default=600, ge=30, le=86400, alias="IDEMPOTENCY_TTL_SECONDS")

    # MCP Gateway Configuration
    mcp_transport: str = Field(default="streamable-http", alias="MCP_TRANSPORT")
    mcp_tool_timeout_seconds: float = Field(default=3.0, alias="MCP_TOOL_TIMEOUT_SECONDS")
    mcp_max_result_bytes: int = Field(
        default=65_536, ge=1024, le=1_048_576, alias="MCP_MAX_RESULT_BYTES"
    )
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

    # Trusted Node/BFF business API used by authenticated MCP tools.
    business_api_base_url: Optional[str] = Field(default=None, alias="BUSINESS_API_BASE_URL")
    business_api_token: Optional[str] = Field(default=None, alias="BUSINESS_API_TOKEN")
    business_api_timeout_seconds: float = Field(
        default=2.5, ge=0.5, le=3.0, alias="BUSINESS_API_TIMEOUT_SECONDS"
    )

    # Signed document ingestion (SSRF and memory bounds)
    ingestion_allowed_hosts: Union[List[str], str] = Field(
        default=[], alias="INGESTION_ALLOWED_HOSTS"
    )
    ingestion_max_file_bytes: int = Field(
        default=25 * 1024 * 1024,
        ge=1024,
        le=100 * 1024 * 1024,
        alias="INGESTION_MAX_FILE_BYTES",
    )
    ingestion_max_pdf_pages: int = Field(
        default=200, ge=1, le=1000, alias="INGESTION_MAX_PDF_PAGES"
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

    @field_validator("ingestion_allowed_hosts", mode="before")
    @classmethod
    def parse_ingestion_allowed_hosts(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [host.strip().lower() for host in v.split(",") if host.strip()]
        return v

    @field_validator("embedding_dimension")
    @classmethod
    def validate_pgvector_dimension(cls, value: int) -> int:
        if value != 1024:
            raise ValueError("Current pgvector schema requires EMBEDDING_DIMENSION=1024")
        return value

    @model_validator(mode="after")
    def validate_runtime_invariants(self) -> "Settings":
        if self.llm_provider.lower() == "gemini" and not self.llm_api_key:
            self.llm_api_key = self.embedding_api_key
        if self.embedding_provider.lower() != "gemini":
            raise ValueError("EMBEDDING_PROVIDER must be 'gemini' for Gemini Embedding 2")
        if self.embedding_model.removeprefix("models/") != "gemini-embedding-2":
            raise ValueError("EMBEDDING_MODEL must be 'gemini-embedding-2'")
        if self.db_statement_cache_size != 0:
            raise ValueError("DB_STATEMENT_CACHE_SIZE must be 0 for Supavisor transaction mode")
        if self.db_pool_min_size > self.db_pool_max_size:
            raise ValueError("DB_POOL_MIN_SIZE must not exceed DB_POOL_MAX_SIZE")
        allowed = self.allowed_tenants
        if isinstance(allowed, str):
            allowed = [item.strip() for item in allowed.split(",") if item.strip()]
        if self.default_tenant not in allowed:
            raise ValueError("DEFAULT_TENANT must be included in ALLOWED_TENANTS")
        if self.app_env.lower() != "development" and not self.internal_service_token:
            raise ValueError("INTERNAL_SERVICE_TOKEN is required outside development")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Returns singleton cached instance of Application Settings."""
    return Settings()
