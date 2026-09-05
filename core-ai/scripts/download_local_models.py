"""Explicitly download optional local models. Runtime itself never downloads weights."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import snapshot_download

MODELS = {
    "prompt-guard": ("meta-llama/Llama-Prompt-Guard-2-86M", "Llama-Prompt-Guard-2-86M"),
    "reranker": ("BAAI/bge-reranker-v2-m3", "bge-reranker-v2-m3"),
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download optional local models for ST-Care core-ai."
    )
    parser.add_argument(
        "models",
        nargs="*",
        help=(
            f"Models to download (choose from: {', '.join(MODELS.keys())}). "
            "If omitted, downloads all models."
        ),
    )
    parser.add_argument(
        "--output-dir", default="models", help="Directory to save downloaded models."
    )
    parser.add_argument(
        "--revision",
        default=None,
        help="Optional immutable Hugging Face commit/tag shared by selected models.",
    )
    args = parser.parse_args()

    selected_models = args.models if args.models else list(MODELS.keys())

    invalid = [m for m in selected_models if m not in MODELS]
    if invalid:
        parser.error(
            f"argument models: invalid choice: {', '.join(repr(m) for m in invalid)} "
            f"(choose from {', '.join(repr(k) for k in MODELS.keys())})"
        )

    root = Path(args.output_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    for name in selected_models:
        repo_id, folder = MODELS[name]
        target = root / folder
        print(f"Downloading {repo_id} -> {target}")
        resolved_path = snapshot_download(
            repo_id=repo_id,
            revision=args.revision,
            local_dir=target,
        )
        manifest = {
            "repo_id": repo_id,
            "revision": args.revision or "default-branch-at-download-time",
            "requested_revision": args.revision,
            "tokenizer_revision": args.revision or "same-as-model",
            "resolved_snapshot_path": str(resolved_path),
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
            "runtime_downloads_enabled": False,
        }
        temporary = target / "download_manifest.json.tmp"
        temporary.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(target / "download_manifest.json")


if __name__ == "__main__":
    main()
