"""Explicitly export a downloaded classifier to ONNX and write checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def export(source: Path, output: Path) -> None:
    from optimum.onnxruntime import ORTModelForSequenceClassification
    from transformers import AutoTokenizer

    output.mkdir(parents=True, exist_ok=True)
    model = ORTModelForSequenceClassification.from_pretrained(str(source), export=True)
    tokenizer = AutoTokenizer.from_pretrained(str(source), local_files_only=True)
    model.save_pretrained(str(output))
    tokenizer.save_pretrained(str(output))
    from onnxruntime.quantization import QuantType, quantize_dynamic

    for model_file in output.glob("*.onnx"):
        quantized = model_file.with_suffix(".int8.onnx")
        quantize_dynamic(str(model_file), str(quantized), weight_type=QuantType.QInt8)
        fp32 = model_file.with_suffix(".fp32.onnx")
        os.replace(model_file, fp32)
        os.replace(quantized, model_file)
    files = {
        str(path.relative_to(output)): checksum(path)
        for path in sorted(output.rglob("*"))
        if path.is_file() and path.name != "model_manifest.json"
    }
    metadata = {
        "repo_id": source.name,
        "revision": "unknown-local-source",
        "tokenizer_revision": "same-as-model",
    }
    source_manifest = source / "download_manifest.json"
    if source_manifest.is_file():
        metadata.update(json.loads(source_manifest.read_text(encoding="utf-8")))
    (output / "model_manifest.json").write_text(
        json.dumps(
            {**metadata, "backend": "onnx_int8", "quantization": "dynamic_qint8", "files": files},
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    export(args.source.resolve(), args.output.resolve())
