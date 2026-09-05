from core_ai.ingestion.chunker import DocumentChunker


def test_heading_and_table_provenance_are_preserved() -> None:
    text = """# Học phí
Mức thu được công bố theo từng học kỳ.

| Khoản | Mức |
|---|---|
| Tín chỉ | Theo thông báo |

# Lịch học
Lịch học được công bố trên cổng đào tạo.
"""
    chunks = DocumentChunker(min_tokens=10, max_tokens=80, target_tokens=30).chunk_text(text)
    assert any(chunk.kind == "table" and chunk.heading_path == ["Học phí"] for chunk in chunks)
    assert any(chunk.heading_path == ["Lịch học"] for chunk in chunks)
    assert len({chunk.content_hash for chunk in chunks}) == len(chunks)
