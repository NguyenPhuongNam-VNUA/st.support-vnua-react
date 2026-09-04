"""Explicitly download optional local models. Runtime itself never downloads weights."""

from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download

MODELS = {
    "prompt-guard": ("meta-llama/Llama-Prompt-Guard-2-86M", "Llama-Prompt-Guard-2-86M"),
    "reranker": ("BAAI/bge-reranker-v2-m3", "bge-reranker-v2-m3"),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("models", nargs="*", choices=MODELS, default=list(MODELS))
    parser.add_argument("--output-dir", default="models")
    args = parser.parse_args()
    root = Path(args.output_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    for name in args.models:
        repo_id, folder = MODELS[name]
        target = root / folder
        print(f"Downloading {repo_id} -> {target}")
        snapshot_download(repo_id=repo_id, local_dir=target)


if __name__ == "__main__":
    main()
