#!/usr/bin/env python3
"""CLI utility to execute offline document ingestion for ST-Care Core AI.

Usage examples:
    # Ingest using a signed URL:
    python scripts/run_ingestion.py --document-id 42 --file-url "https://supabase.../sample.pdf"

    # Ingest using a local PDF file:
    python scripts/run_ingestion.py --document-id 42 --file-path "tests/data/sample_regulations.pdf"
"""

import argparse
import asyncio
import logging
import sys
import time

# Ensure src/ is on sys.path when script is executed directly
from pathlib import Path
repo_root = Path(__file__).resolve().parent.parent
src_path = repo_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from core_ai.config import get_settings
from core_ai.data.postgres import close_db_pool, init_db_pool
from core_ai.ingestion.worker import IngestionWorker


def setup_logging(verbose: bool = False) -> None:
    """Configures structured console logging for the ingestion CLI."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


async def main_async(args: argparse.Namespace) -> int:
    """Main asynchronous execution flow for ingestion CLI."""
    settings = get_settings()
    logger = logging.getLogger("run_ingestion")

    file_source = args.file_url or args.file_path
    if not file_source:
        logger.error("Error: Either --file-url or --file-path must be specified.")
        return 1

    logger.info("=" * 60)
    logger.info("ST-Care Core AI — Offline Document Ingestion Runner")
    logger.info("=" * 60)
    logger.info("Document ID : %d", args.document_id)
    logger.info("File Source : %s", file_source)
    logger.info("Tenant ID   : %s", args.tenant_id)
    logger.info("Database URL: %s", settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url)

    # 1. Initialize PostgreSQL pool
    logger.info("Connecting to PostgreSQL pool...")
    try:
        await init_db_pool(settings)
    except Exception as exc:
        logger.error("Failed to connect to database: %s", exc)
        return 1

    # 2. Instantiate and run IngestionWorker
    worker = IngestionWorker(settings=settings)
    job_id = f"cli_embed_{args.document_id}_{int(time.time())}"

    try:
        result = await worker.process_document(
            document_id=args.document_id,
            file_url=file_source,
            job_id=job_id,
            tenant_id=args.tenant_id,
        )

        logger.info("=" * 60)
        logger.info("INGESTION SUCCESSFUL!")
        logger.info("=" * 60)
        logger.info("Status            : %s", result.get("status"))
        logger.info("Document ID       : %d", result.get("document_id"))
        logger.info("Total Pages       : %d", result.get("total_pages"))
        logger.info("Total Characters  : %d", result.get("total_characters"))
        logger.info("Chunks Created    : %d", result.get("chunks_count"))
        logger.info("Parser Engine Used: %s", result.get("parser_used"))
        logger.info("Duration          : %.2fs", result.get("duration_seconds", 0.0))
        logger.info("=" * 60)
        return 0

    except Exception as exc:
        logger.error("Ingestion failed with unhandled exception: %s", exc, exc_info=True)
        return 1

    finally:
        logger.info("Closing database connection pool...")
        await close_db_pool()


def main() -> None:
    """CLI entrypoint parsing command line arguments."""
    parser = argparse.ArgumentParser(
        description="Offline document ingestion worker for ST-Care Core AI microservice."
    )
    parser.add_argument(
        "--document-id",
        type=int,
        required=True,
        help="PostgreSQL documents.id (integer primary key).",
    )
    parser.add_argument(
        "--file-url",
        type=str,
        default=None,
        help="Remote HTTP/HTTPS signed URL to download PDF from.",
    )
    parser.add_argument(
        "--file-path",
        type=str,
        default=None,
        help="Local filesystem path to PDF document.",
    )
    parser.add_argument(
        "--tenant-id",
        type=str,
        default="vnua",
        help="Tenant isolation identifier (default: vnua).",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose DEBUG logging.",
    )

    args = parser.parse_args()
    setup_logging(verbose=args.verbose)

    exit_code = asyncio.run(main_async(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
