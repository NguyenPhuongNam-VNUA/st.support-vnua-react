# Kế hoạch triển khai RAG tài liệu quy chế VNUA

> Phiên bản kế hoạch: `1.0`  
> Ngày lập: `2026-09-12`  
> Phạm vi: OCR, Markdown chuẩn, semantic chunking, metadata, embedding, FAQ retrieval và truy xuất minh bạch  
> Trạng thái: Đề xuất triển khai

## 1. Mục tiêu

Xây dựng một pipeline thống nhất cho quy chế, quyết định, thông báo và văn bản hướng dẫn của trường:

```text
PDF gốc
  → trích xuất text hoặc OCR theo từng trang
  → sắp xếp lại đúng thứ tự đọc
  → tạo và lưu bản Markdown chuẩn
  → chia chunk theo cấu trúc và ngữ nghĩa pháp quy
  → gắn metadata chi tiết
  → embedding với giới hạn toàn cục 1 request/5 giây
  → lưu pgvector
  → truy xuất FAQ + tài liệu
  → xếp hạng xác định, giải thích nguồn và sinh câu trả lời
```

Kết quả cần đạt:

- Toàn bộ nội dung phải đi qua bản Markdown có thể kiểm tra trước khi embedding.
- Không đảo trang, đảo cột, mất Điều/Khoản/Điểm hoặc cắt đứt mạch văn.
- Tìm kiếm được cả ngân hàng câu hỏi `questions` và tài liệu `document_chunks`.
- Ưu tiên văn bản đang có hiệu lực và đúng phạm vi áp dụng cho sinh viên.
- Mỗi kết quả phải truy ngược được về tài liệu, phiên bản, trang và vị trí trong Markdown.
- Hai job chạy đồng thời vẫn không vượt quá một request embedding mỗi 5 giây trên toàn hệ thống.

### Chính sách gọi model bắt buộc

Hệ thống chỉ được gọi model/API AI tại hai điểm:

1. **Embedding**: tạo vector cho chunk tài liệu, FAQ và câu hỏi truy vấn.
2. **Sinh output**: tạo câu trả lời cuối cùng từ context đã truy xuất và kiểm chứng.

Các bước OCR, sửa thứ tự đọc, tạo Markdown, nhận diện cấu trúc, chunking, trích metadata, query normalization, filter, fusion và xếp hạng **không được gọi LLM**. Chúng phải dùng thư viện cục bộ và thuật toán xác định. Nội dung gốc không được LLM tóm tắt hoặc viết lại trước embedding.

## 2. Hiện trạng và khoảng trống

| Hạng mục | Hiện trạng | Khoảng trống cần xử lý |
|---|---|---|
| FAQ embedding | Bảng `questions` có embedding hợp lệ | Luồng chatbot chưa gọi `search_faq()` và retriever chưa được inject `QuestionRepository` |
| Tài liệu RAG | Retrieval chỉ đọc `document_chunks` | Hiện chưa có chunk tài liệu để truy xuất |
| PDF parser | Đang trích xuất bằng `pdfplumber` | Chưa có OCR thực tế cho PDF scan và chưa xử lý thứ tự đọc nâng cao |
| Markdown | Chưa có bản Markdown trung gian | Không thể kiểm tra, version hoặc truy vết nội dung trước chunking |
| Chunking | Có heading/sentence/table boundary và overlap | Heading Markdown không được sinh từ PDF; chưa hiểu Chương/Mục/Điều/Khoản/Điểm |
| Embedding limit | Tối đa 5 request đồng thời trong từng job | Chưa có giới hạn toàn cục 1 request/5 giây và retry `429` |
| Metadata | Có một số trường cơ bản | Thiếu ngày ban hành, ngày hiệu lực, số văn bản, phạm vi áp dụng và vị trí Markdown |
| Minh bạch retrieval | Có similarity/citation cơ bản | Chưa trả đủ dense, sparse, fusion, freshness, trust và lý do chọn nguồn |

## 3. Nguyên tắc semantic chunking

### 3.1. Có nên chunk theo ngữ nghĩa không?

Có. Tuy nhiên, với văn bản quy chế, nên dùng **semantic chunking có ràng buộc cấu trúc**, không để LLM tự do quyết định mọi điểm cắt.

Thứ tự ưu tiên điểm cắt:

```text
Phần → Chương → Mục → Điều → Khoản → Điểm → đoạn văn → câu
```

Cấu trúc pháp quy là tín hiệu ngữ nghĩa đáng tin cậy nhất. Chỉ dùng độ dài token khi một đơn vị pháp quy quá lớn. Cách này ổn định, kiểm thử được, không phát sinh thêm request LLM và không làm nội dung thay đổi giữa các lần ingest.

### 3.2. Cấu hình đề xuất

| Tham số | Giá trị | Ý nghĩa |
|---|---:|---|
| `CHUNK_TARGET_TOKENS` | 600 | Mục tiêu mềm, không cắt một đơn vị đang hoàn chỉnh chỉ để đạt đúng số này |
| `CHUNK_MIN_TOKENS` | 200 | Mức tối thiểu mềm; chunk ngắn nhưng trọn Điều/Khoản vẫn được giữ |
| `CHUNK_MAX_TOKENS` | 900 | Bắt đầu tìm ranh giới con để tách |
| `CHUNK_HARD_MAX_TOKENS` | 1100 | Chỉ vượt khi một bảng hoặc đơn vị bất khả phân cần giữ nguyên |
| `CHUNK_OVERLAP_TOKENS` | 80 | Chỉ áp dụng giữa các phần của cùng một Điều |
| `RETRIEVAL_TOP_K` | 5 | Số nguồn tối đa sau fusion và xếp hạng xác định |

### 3.3. Quy tắc chia chunk

1. Một Điều không quá 900 token được giữ trọn trong một chunk.
2. Điều dài hơn 900 token được chia tại ranh giới Khoản.
3. Khoản vẫn quá dài được chia tại ranh giới Điểm `a)`, `b)`, `c)`.
4. Điểm vẫn quá dài mới được chia theo đoạn; câu là điểm cắt cuối cùng.
5. Không overlap giữa hai Điều, hai Mục hoặc hai Chương khác nhau.
6. Không tách heading khỏi đoạn nội dung đầu tiên của heading đó.
7. Không ghép chunk ngắn cuối Điều với Điều kế tiếp chỉ để đạt `CHUNK_MIN_TOKENS`.
8. Mỗi chunk con phải lặp lại breadcrumb cấu trúc để có thể hiểu độc lập.
9. Bảng được giữ nguyên nếu không vượt hard max. Nếu buộc phải chia, chia theo nhóm dòng và lặp header bảng.
10. Phụ lục, biểu mẫu, định nghĩa và điều khoản chuyển tiếp dùng `chunk_type` riêng để retrieval có thể lọc hoặc tăng trọng số.

### 3.4. Nội dung thực tế gửi đi embedding

Không chỉ embedding phần thân. Mỗi chunk được dựng thành một văn bản có ngữ cảnh:

```text
Tài liệu: Quy chế đào tạo trình độ đại học năm 2026
Số văn bản: 123/QĐ-HVN
Ngày ban hành: 2026-08-20
Hiệu lực: từ 2026-09-01
Phạm vi: Sinh viên đại học chính quy
Chương III: Tổ chức đào tạo
Mục 2: Đăng ký học phần
Điều 15: Khối lượng đăng ký học tập

2. Sinh viên được đăng ký tối đa...
3. Trong học kỳ cuối khóa...
```

Không đưa metadata kỹ thuật như hash, parser hoặc confidence vào nội dung embedding; các trường đó chỉ dùng để lọc và truy vết.

### 3.5. Fallback ngữ nghĩa cho văn bản không có cấu trúc rõ

Không phải PDF nào cũng nhận diện được Chương/Mục/Điều. Với thông báo, hướng dẫn hoặc bản OCR mất heading, chunker xử lý theo hai tầng:

1. Nhóm các đoạn liền kề dựa trên heading, danh sách đánh số, cụm từ chuyển chủ đề và giới hạn token; giữ nguyên thứ tự tuyệt đối.
2. Nếu benchmark cho thấy tầng trên chưa đủ tốt, dùng lexical-cohesion breakpoint xác định: so sánh keyword, cụm danh từ, số Điều/Khoản và độ tương đồng từ vựng giữa các đoạn liền kề.

Không gọi Gemini hoặc model cục bộ để quyết định điểm cắt. Có thể dùng regex, tập từ dừng tiếng Việt, Jaccard/cosine trên vector tần suất từ hoặc `rapidfuzz` đã có trong dự án. Các ranh giới Điều/Khoản/Bảng và thứ tự trang luôn là ràng buộc cứng.

## 4. Pipeline PDF/OCR sang Markdown

### 4.1. Xử lý theo từng trang

OCR dùng thư viện/CLI cục bộ, không dùng vision LLM:

- `pdfplumber`: lấy text, block và bảng từ PDF có text thật.
- Bộ render trang PDF cục bộ: chuyển riêng trang scan thành ảnh khoảng 300 DPI.
- `Tesseract OCR` với language pack `vie+eng`: nhận dạng chữ và xuất TSV để lấy text, tọa độ, thứ tự cùng confidence. Tesseract tiếng Việt đã có trong Docker image; phần cần bổ sung là adapter gọi OCR và page renderer.
- Python `re`, `unicodedata` và thuật toán tọa độ: chuẩn hóa Unicode, nhận diện cấu trúc và dựng lại thứ tự đọc.

Không gửi ảnh, PDF hoặc text OCR lên LLM. Không dùng LLM để sửa chính tả OCR vì có nguy cơ làm thay đổi câu chữ pháp lý.

Mỗi trang tạo ra danh sách block chuẩn:

```json
{
  "page_number": 12,
  "block_order": 7,
  "block_type": "paragraph",
  "bbox": [74.2, 318.0, 522.7, 405.1],
  "text": "2. Sinh viên được đăng ký...",
  "source": "native_text",
  "ocr_confidence": null
}
```

Quy tắc chọn nguồn text:

- Dùng text gốc khi trang có đủ ký tự, tỷ lệ ký tự lỗi thấp và thứ tự block hợp lý.
- Chuyển sang OCR khi trang gần như không có text, text bị mã hóa lỗi, hoặc phần lớn nội dung là ảnh.
- Với PDF hỗn hợp, quyết định theo từng trang; không OCR lại toàn bộ tài liệu nếu không cần.
- Render trang OCR khoảng 300 DPI, tự phát hiện xoay và dùng ngôn ngữ `vie+eng`.
- Lưu `native_text` và `ocr_text` riêng trong dữ liệu tạm để kiểm tra, nhưng chỉ một bản tốt nhất được đưa vào Markdown.

### 4.2. Bảo đảm đúng thứ tự và không đứt mạch

- Mọi block mang `page_number`, `column_index`, `block_order` và tọa độ `bbox`.
- Sắp xếp trang trước, sau đó cột trái sang phải, rồi block trên xuống dưới.
- Nếu OCR chạy song song, chỉ ghép tài liệu sau khi sort lại theo khóa `(page_number, column_index, block_order)`.
- Header/footer lặp lại trên nhiều trang được loại bỏ bằng normalized hash và vùng tọa độ.
- Không loại bỏ số trang, số Điều hoặc số Khoản chỉ vì chúng xuất hiện gần đầu/cuối trang.
- Nối câu qua trang khi trang trước không kết thúc câu và trang sau tiếp tục bằng chữ thường hoặc nội dung cùng Khoản.
- Không nối qua trang nếu trang sau bắt đầu bằng Phần, Chương, Mục, Điều hoặc một heading độc lập.
- Dehyphenation chỉ nối từ bị ngắt dòng thực sự; không xóa dấu gạch đầu dòng hoặc dấu gạch có ý nghĩa pháp lý.
- Kiểm tra chuỗi số Điều/Khoản để phát hiện thiếu, lặp hoặc đảo thứ tự.

### 4.3. Ngưỡng chất lượng OCR

| Điều kiện | Xử lý |
|---|---|
| Confidence trang `>= 0.90` | Tự động tiếp tục |
| Từ `0.85` đến dưới `0.90` | Tiếp tục nhưng gắn cờ cảnh báo |
| Dưới `0.85` | Đưa tài liệu sang `needs_review` trước embedding |
| Có khoảng trống số Điều/Khoản bất thường | `needs_review` bất kể confidence |
| Không đọc được bảng quan trọng | `needs_review`, không tự suy đoán ô bị thiếu |

### 4.4. Định dạng Markdown chuẩn

```md
---
document_id: 42
tenant_id: vnua
title: "Quy chế đào tạo trình độ đại học"
document_number: "123/QĐ-HVN"
document_type: "quy_che"
issuer: "Học viện Nông nghiệp Việt Nam"
issued_date: "2026-08-20"
effective_from: "2026-09-01"
effective_to: null
validity_status: "effective"
version: "2026.1"
source_sha256: "..."
extraction_version: "1"
---

<!-- page: 1 -->

# QUY CHẾ ĐÀO TẠO TRÌNH ĐỘ ĐẠI HỌC

## Chương I. QUY ĐỊNH CHUNG

### Điều 1. Phạm vi điều chỉnh

1. Quy chế này quy định...

<!-- page: 2 -->

### Điều 2. Đối tượng áp dụng

...
```

File Markdown được lưu theo đường dẫn có version, ví dụ:

```text
documents/normalized/{tenant_id}/{document_id}/{source_sha256}.md
```

## 5. Thiết kế metadata

Metadata nên chia làm hai lớp:

- **Cột chuẩn**: trường thường xuyên được filter, sort, join hoặc lập index.
- **`metadata jsonb`**: trường nâng cao, thay đổi theo từng loại tài liệu và chưa cần index riêng.

Cách này giữ truy vấn rõ ràng mà không phải tạo hàng chục cột ít sử dụng.

### 5.1. Metadata cấp tài liệu

| Nhóm | Trường | Kiểu đề xuất | Mục đích |
|---|---|---|---|
| Định danh | `id`, `tenant_id` | bigint, text | Cô lập dữ liệu và liên kết |
| Định danh pháp lý | `document_number` | text | Số quyết định/quy chế/thông báo |
| Phân loại | `document_type` | text/enum | `quy_che`, `quyet_dinh`, `thong_bao`, `huong_dan`, `quy_trinh`, `phu_luc` |
| Tên | `title`, `short_title` | text | Hiển thị và tìm kiếm |
| Cơ quan | `issuer`, `issuing_unit` | text | Đơn vị ban hành |
| Người ký | `signed_by`, `signer_title` | text | Truy vết thẩm quyền |
| Ngày văn bản | `signed_date`, `issued_date`, `published_at` | date/timestamptz | Phân biệt ngày ký, ban hành và công bố |
| Hiệu lực | `effective_from`, `effective_to` | date | Lọc văn bản theo thời điểm câu hỏi |
| Trạng thái | `validity_status` | enum | `draft`, `effective`, `partially_effective`, `expired`, `superseded`, `revoked` |
| Phiên bản | `version`, `revision_number` | text, integer | Xác định bản tài liệu |
| Quan hệ văn bản | `supersedes_document_id`, `superseded_by_document_id` | bigint nullable | Tránh lấy quy định cũ |
| Văn bản liên quan | `related_document_ids` | bigint[]/jsonb | Quyết định sửa đổi, phụ lục, hướng dẫn |
| Phạm vi | `audiences` | text[] | Sinh viên, giảng viên, cán bộ |
| Đào tạo | `education_levels`, `study_modes` | text[] | Đại học, sau đại học; chính quy, vừa làm vừa học |
| Đơn vị áp dụng | `faculties`, `programs`, `campuses` | text[] | Filter theo khoa/ngành/cơ sở |
| Thời gian học vụ | `academic_year`, `semester`, `cohorts` | text, text, text[] | Lọc theo khóa và kỳ học |
| Nguồn | `source_url`, `original_filename`, `file_path` | text | Truy ngược nguồn gốc |
| Toàn vẹn | `source_sha256`, `markdown_sha256` | text | Phát hiện nội dung thay đổi |
| Markdown | `markdown_path`, `markdown_generated_at` | text, timestamptz | Bản chuẩn dùng để chunk |
| Ingestion | `pipeline_stage`, `progress`, `ingestion_quality` | text, int, numeric | Theo dõi pipeline |
| OCR | `parser_used`, `ocr_page_count`, `ocr_confidence_avg`, `ocr_confidence_min` | text, int, numeric | Kiểm soát chất lượng |
| Version xử lý | `extraction_version`, `chunking_version` | text | Reprocess có kiểm soát |
| Embedding | `embedding_provider`, `embedding_model`, `embedding_dimension` | text, text, int | Tương thích vector |
| Tin cậy | `source_trust` | numeric | Tăng trọng số nguồn chính thức |
| Kiểm duyệt | `review_status`, `reviewed_by`, `reviewed_at` | text, bigint, timestamptz | Không public OCR lỗi |
| Audit | `created_at`, `updated_at`, `created_by` | timestamptz, bigint | Truy vết thay đổi |

### 5.2. Metadata cấp chunk

| Nhóm | Trường | Kiểu đề xuất | Mục đích |
|---|---|---|---|
| Định danh | `id`, `document_id`, `tenant_id`, `chunk_index` | bigint/int/text | Liên kết và giữ thứ tự |
| Loại chunk | `chunk_type` | text | `article`, `clause`, `definition`, `table`, `appendix`, `form`, `transition` |
| Cấu trúc | `heading_path` | jsonb | Breadcrumb đầy đủ |
| Pháp quy | `part`, `chapter`, `section`, `article`, `clause`, `point` | text nullable | Filter đúng Điều/Khoản/Điểm |
| Chủ đề | `semantic_topics` | text[] | Học phí, đăng ký học phần, học bổng, tốt nghiệp... |
| Từ khóa | `keywords` | text[] | Tăng chất lượng sparse search |
| Thực thể | `entities` | jsonb | Khoa, ngành, khóa, mức tiền, thời hạn, biểu mẫu |
| Vị trí trang | `page_start`, `page_end` | int | Citation theo PDF |
| Vị trí Markdown | `markdown_start_offset`, `markdown_end_offset` | int | Truy ngược chính xác về `.md` |
| Vị trí block | `block_start`, `block_end` | int | Kiểm tra thứ tự |
| Quan hệ chunk | `previous_chunk_id`, `next_chunk_id`, `parent_chunk_id` | bigint nullable | Mở rộng context liền kề |
| Độ dài | `tokens`, `characters` | int | Quản lý kích thước |
| Toàn vẹn | `content_hash` | text | Cache và chống embedding trùng |
| Tính hoàn chỉnh | `is_complete_semantic_unit` | boolean | Biết chunk có bị chia nhỏ hay không |
| Lý do tách | `split_reason` | text | `article_boundary`, `clause_boundary`, `size_limit`, `table_rows` |
| OCR | `contains_ocr`, `ocr_confidence_min` | boolean, numeric | Hạ trọng số hoặc cảnh báo nguồn lỗi |
| Ngày/hiệu lực | `issued_date`, `effective_from`, `effective_to`, `validity_status` | date/text | Cho phép filter ngay tại retrieval |
| Phạm vi | `audiences`, `education_levels`, `faculties`, `programs`, `cohorts` | text[] | Cá nhân hóa kết quả |
| Embedding | `embedding_model`, `embedding_dimension`, `embedded_at` | text/int/timestamptz | Audit vector |
| Version | `knowledge_version`, `chunking_version` | bigint/text | Invalidate cache và tái lập index |
| Metadata mở rộng | `metadata` | jsonb | Trường đặc thù chưa cần cột riêng |

Ngày hiệu lực và phạm vi được sao chép có chủ đích từ document xuống chunk để lọc nhanh. Document vẫn là nguồn chuẩn; khi cập nhật phải reindex đồng bộ toàn bộ chunk của version đó.

### 5.3. Metadata JSONB nâng cao

```json
{
  "legal_references": ["Luật Giáo dục 2019", "Thông tư 08/2021/TT-BGDĐT"],
  "obligations": ["đăng ký học phần đúng thời hạn"],
  "exceptions": ["sinh viên học kỳ cuối"],
  "deadlines": [
    {
      "label": "thời hạn đăng ký",
      "value": "trước ngày bắt đầu học kỳ",
      "normalized_date": null
    }
  ],
  "monetary_values": [
    {
      "amount": 500000,
      "currency": "VND",
      "label": "lệ phí"
    }
  ],
  "document_language": "vi",
  "has_table": false,
  "has_formula": false,
  "has_signature": false,
  "source_page_labels": ["12", "13"]
}
```

### 5.4. Cách làm giàu metadata và chunk, không dùng LLM

Nội dung chunk gốc được giữ bất biến. Hệ thống chỉ tạo thêm `search_text` và metadata có thể kiểm chứng:

| Dữ liệu làm giàu | Cách tạo xác định | Ví dụ |
|---|---|---|
| Breadcrumb | Kế thừa từ cây Phần/Chương/Mục/Điều/Khoản | `Chương III > Điều 15 > Khoản 2` |
| Số và loại văn bản | Regex trên trang đầu và dữ liệu admin nhập | `123/QĐ-HVN`, `quyet_dinh` |
| Ngày tháng | Regex định dạng ngày và các cụm `ngày ban hành`, `có hiệu lực từ` | `2026-09-01` |
| Đơn vị/người ký | Trường admin hoặc vùng nhãn cố định trên trang đầu/cuối | `Học viện Nông nghiệp Việt Nam` |
| Chủ đề | Từ điển taxonomy có version | `dang_ky_hoc_phan`, `hoc_phi` |
| Keyword | Tần suất từ/cụm từ sau khi bỏ stopword | `tín chỉ`, `học kỳ`, `đăng ký` |
| Thực thể | Regex/từ điển | số tiền, hạn nộp, mã biểu mẫu, khóa học |
| Alias tìm kiếm | Từ điển đồng nghĩa được quản trị | `đăng ký môn` → `đăng ký học phần` |
| Quan hệ văn bản | Admin xác nhận hoặc số văn bản được trích chính xác | sửa đổi, thay thế, bãi bỏ |
| Hiệu lực | Từ cột tài liệu đã duyệt, kế thừa xuống chunk | `effective`, `superseded` |

`search_text` dùng cho BM25/FTS có dạng:

```text
{title} {document_number} {breadcrumb} {controlled_aliases} {chunk_content}
```

`controlled_aliases` chỉ đến từ taxonomy đã duyệt, không phải nội dung do model sinh. Trường `content` và bản Markdown không bị chèn alias để citation vẫn khớp nguyên văn.

Mỗi giá trị metadata tự động trích phải có provenance, ví dụ:

```json
{
  "field": "effective_from",
  "value": "2026-09-01",
  "value_source": "regex_from_document",
  "source_page": 1,
  "source_text": "Quyết định này có hiệu lực từ ngày 01/09/2026",
  "extraction_rule": "effective_date_v1",
  "confidence": 0.98,
  "reviewed": true
}
```

Nguồn ưu tiên theo thứ tự: metadata admin đã duyệt → trường ghi rõ trong văn bản → kế thừa từ document → taxonomy xác định. Không suy đoán ngày hiệu lực hoặc phạm vi áp dụng khi văn bản không ghi rõ.

Các trường suy diễn như topic, obligation hoặc exception phải mang `metadata_extraction_method`, `metadata_rule_version`, `metadata_confidence` và đoạn bằng chứng; không được coi là nội dung pháp lý gốc.

## 6. Retrieval FAQ và tài liệu

### 6.1. Một query embedding, hai nguồn tìm kiếm

```text
Câu hỏi sinh viên
  → tạo query embedding đúng một lần
  ├→ FAQ vector search trên questions
  └→ document hybrid search: pgvector + BM25
       → filter hiệu lực và phạm vi
       → RRF + weighted ranking xác định
       → context + citation
```

Quy tắc đề xuất:

- FAQ phải có `status = approved`, đúng `tenant_id`, model và dimension.
- FAQ similarity `>= 0.85`: có thể trả answer đã duyệt trực tiếp qua output guardrail.
- FAQ similarity từ `0.75` đến dưới `0.85`: chỉ dùng làm context bổ sung.
- FAQ dưới `0.75`: bỏ qua.
- Văn bản `effective` được ưu tiên hơn văn bản `expired`, `superseded` hoặc `revoked`.
- Chỉ lấy văn bản hết hiệu lực khi người dùng hỏi rõ về thời kỳ cũ.
- FAQ quan trọng nên được gắn `source_document_id`, `source_article` và `verified_at`; FAQ quá hạn xác minh không được trả trực tiếp.

### 6.2. Công thức xếp hạng có thể giải thích, không dùng model reranker

Điểm cuối không cần quá phức tạp, nhưng phải ghi lại từng thành phần:

```text
final_score =
  0.55 × dense_similarity
  + 0.25 × sparse_score
  + 0.15 × validity_score
  + 0.05 × source_trust
```

`dense_similarity` tái sử dụng query embedding đã tạo, không gọi thêm model. `sparse_score`, RRF, filter và weighted ranking đều chạy bằng PostgreSQL/Python. Tắt BGE/local model reranker để giữ đúng chính sách chỉ gọi model tại embedding và final output.

Không dùng ngày mới hơn để tự động thắng nếu câu hỏi đang hỏi một năm học cũ. `validity_score` phải được tính theo thời điểm mà người dùng đề cập hoặc ngày hiện tại khi không có thời điểm.

### 6.3. Thông tin minh bạch trả về citation/trace

```json
{
  "source_type": "document",
  "document_id": 42,
  "document_number": "123/QĐ-HVN",
  "title": "Quy chế đào tạo trình độ đại học",
  "issued_date": "2026-08-20",
  "effective_from": "2026-09-01",
  "validity_status": "effective",
  "page_start": 12,
  "page_end": 13,
  "article": "Điều 15",
  "clause": "Khoản 2",
  "chunk_index": 17,
  "dense_similarity": 0.88,
  "sparse_score": 0.67,
  "fusion_score": 0.84,
  "final_score": 0.87,
  "selection_reason": [
    "semantic_match",
    "keyword_match",
    "document_effective",
    "audience_match"
  ]
}
```

Không trả chain-of-thought. Chỉ trả các điểm số, filter và lý do chọn nguồn có thể kiểm chứng.

## 7. Giới hạn embedding 1 request/5 giây

### 7.1. Cấu hình

```env
EMBEDDING_MAX_CONCURRENCY=1
EMBEDDING_MIN_INTERVAL_SECONDS=5
EMBEDDING_MAX_RETRIES=3
```

Giới hạn này là toàn cục, không phải theo từng document hoặc từng process.

### 7.2. Cách thực hiện

- Dùng Redis hiện có để đặt `next_allowed_at` hoặc cấp slot bằng thao tác atomic.
- Mọi document job và FAQ job phải đi qua cùng limiter.
- Có local `asyncio.Lock` làm fallback khi Redis tạm thời lỗi trong cấu hình một instance.
- Khoảng cách giữa thời điểm **bắt đầu** hai request liên tiếp phải tối thiểu 5 giây.
- Không giữ hàng nghìn coroutine chờ trong RAM; worker xử lý tuần tự danh sách content hash còn thiếu.
- Cache theo `(tenant_id, content_hash, embedding_model, embedding_dimension)` trước khi xin slot.
- `429`: tôn trọng `Retry-After`; nếu không có thì backoff `5s → 10s → 20s`.
- `500/502/503` hoặc timeout: retry tối đa 3 lần và vẫn đi qua limiter.
- Lỗi dimension, payload hoặc dữ liệu: fail ngay, không retry.
- Ghi `attempt_count`, `last_error`, `last_attempt_at` và `embedded_at` để resume.

Thời gian tối thiểu ước tính, chưa tính latency API:

| Chunk mới | Thời gian tối thiểu |
|---:|---:|
| 10 | khoảng 45 giây |
| 50 | khoảng 4 phút 5 giây |
| 100 | khoảng 8 phút 15 giây |
| 500 | khoảng 41 phút 35 giây |

## 8. Thay đổi dữ liệu đề xuất

### 8.1. Trường nên là cột có index

`documents`:

```text
document_number, document_type, issuer,
issued_date, effective_from, effective_to, validity_status,
academic_year, semester,
markdown_path, markdown_sha256,
extraction_version, chunking_version,
review_status, reviewed_at,
metadata jsonb
```

`document_chunks`:

```text
chunk_type,
page_start, page_end,
part, chapter, section, article, clause, point,
semantic_topics text[], keywords text[],
markdown_start_offset, markdown_end_offset,
previous_chunk_id, next_chunk_id, parent_chunk_id,
is_complete_semantic_unit, split_reason,
issued_date, effective_from, effective_to, validity_status,
audiences text[], faculties text[], programs text[], cohorts text[],
embedded_at,
metadata jsonb
```

`questions`:

```text
source_document_id,
source_article,
source_clause,
verified_at,
valid_from,
valid_to,
metadata jsonb
```

### 8.2. Index đề xuất

```sql
-- Lọc tài liệu đang có hiệu lực theo tenant.
create index on documents (tenant_id, validity_status, effective_from, effective_to)
where is_active = true and pipeline_stage = 'ready';

-- Lấy chunk đúng thứ tự trong tài liệu.
create index on document_chunks (tenant_id, document_id, chunk_index);

-- Filter theo Điều và hiệu lực.
create index on document_chunks (tenant_id, validity_status, effective_from, effective_to);
create index on document_chunks (tenant_id, document_id, article);

-- Metadata mở rộng chỉ thêm khi đã có truy vấn thực tế sử dụng.
create index on document_chunks using gin (semantic_topics);
create index on document_chunks using gin (keywords);
```

Không tạo GIN index cho toàn bộ `metadata` ngay từ đầu; chỉ thêm khi truy vấn thực tế chứng minh cần thiết.

## 9. Kế hoạch thực hiện

| Giai đoạn | Công việc | File/khu vực chính | Đầu ra | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| 1. Migration | Bổ sung metadata, ngày hiệu lực, Markdown và trạng thái review | `supabase/migrations/` | Schema mới có index cần thiết | Migration chạy lại an toàn, không mất dữ liệu cũ |
| 2. OCR theo trang | Phát hiện trang scan; OCR `vie+eng`; giữ block, bbox và confidence | `core-ai/src/core_ai/ingestion/pdf_parser.py` | `ParsedPDF` chứa ordered blocks | Digital, scan và mixed PDF đều đọc được |
| 3. Markdown builder | Chuyển ordered blocks thành canonical Markdown và lưu Storage | `core-ai/src/core_ai/ingestion/` | File `.md` và hash | Có thể xem Markdown trước embedding |
| 4. Semantic parser | Nhận diện Phần/Chương/Mục/Điều/Khoản/Điểm, bảng và phụ lục | `core-ai/src/core_ai/ingestion/chunker.py` | Cây cấu trúc pháp quy | Không mất heading hoặc đổi thứ tự |
| 5. Semantic chunker | Tách theo cấu trúc, chỉ dùng token ở đơn vị quá lớn | `chunker.py` | Chunk + metadata + links | Không cắt Điều/Khoản sai quy tắc |
| 6. Embedding limiter | Redis global limiter, cache, retry và resume | `retrieval/embeddings.py`, `ingestion/worker.py`, `config.py` | 1 request/5 giây | Concurrent jobs vẫn giữ khoảng cách >=5 giây |
| 7. Lưu dữ liệu | Upsert document/chunk metadata và Markdown provenance | `data/repositories/document_repo.py` | DB truy vết đầy đủ | Mỗi chunk mở được đúng trang và vị trí `.md` |
| 8. FAQ retrieval | Inject `QuestionRepository` và gọi FAQ search | `dependencies.py`, `retrieval/vector_search.py`, graph nodes | FAQ approved được tìm thấy | Bộ 385 FAQ có thể tham gia trả lời |
| 9. Filter/xếp hạng | Thêm validity, audience, academic year, source trust và weighted ranking xác định | `retrieval/`, graph nodes | Kết quả đúng thời kỳ/phạm vi, không gọi model reranker | Văn bản hết hiệu lực không lấn át bản hiện hành |
| 10. Citation/trace | Mở rộng response metadata và selection reason | contracts, guardrail, frontend | Citation minh bạch | UI hiển thị nguồn, Điều, trang, hiệu lực và điểm |
| 11. Kiểm thử | OCR, order, chunk invariants, rate limiter, retrieval benchmark | `core-ai/tests/` | Test suite và báo cáo | Đạt toàn bộ Definition of Done |

## 10. Kiểm thử bắt buộc

### 10.1. OCR và thứ tự

- PDF text gốc, PDF scan, PDF hỗn hợp.
- Trang xoay 90/180 độ.
- Văn bản hai cột.
- Bảng nhiều trang và bảng có ô trống.
- Header/footer lặp.
- Câu, Khoản hoặc bảng tiếp tục qua trang.
- Kiểm tra không thiếu, lặp hoặc đảo `page_number` và `block_order`.

### 10.2. Chunking

- Heading luôn đi cùng nội dung đầu tiên.
- Không chunk nào trộn hai Chương/Mục không liên quan.
- Điều ngắn giữ nguyên; Điều dài tách tại Khoản trước khi tách câu.
- Overlap chỉ xuất hiện giữa chunk con cùng Điều.
- Bảng chia nhỏ luôn lặp header.
- `previous_chunk_id` và `next_chunk_id` tạo thành chuỗi đúng thứ tự.
- Mỗi chunk truy ngược được bằng Markdown offsets.

### 10.3. Embedding limiter

- Một job có nhiều chunk: mọi request bắt đầu cách nhau ít nhất 5 giây.
- Hai hoặc nhiều job song song: vẫn chỉ một request toàn cục mỗi 5 giây.
- Redis restart: local fallback không cho burst trong single-instance mode.
- Retry `429`: không bỏ qua limiter.
- Restart job: chunk đã có cùng hash không được embedding lại.

### 10.4. Retrieval

- FAQ approved có thể được tìm thấy bằng vector.
- Query chỉ tạo embedding một lần và dùng lại cho FAQ/document search.
- Văn bản hiện hành được ưu tiên.
- Câu hỏi chứa mốc thời gian cũ lấy đúng version lịch sử.
- Filter khoa, ngành, khóa, hệ đào tạo không làm rò dữ liệu tenant khác.
- Benchmark bằng tập câu hỏi sinh viên thực tế, mục tiêu `Recall@3 >= 90%`.

## 11. Definition of Done

- [ ] 100% chunk được tạo từ canonical Markdown đã lưu.
- [ ] Có OCR thật cho trang scan và review gate cho confidence thấp.
- [ ] Nội dung giữ đúng trang, cột, Chương, Mục, Điều, Khoản và Điểm.
- [ ] Semantic chunking không phụ thuộc LLM và cho kết quả xác định qua nhiều lần chạy.
- [ ] Mỗi chunk có metadata ngày ban hành, hiệu lực, phạm vi và provenance.
- [ ] Khoảng cách bắt đầu giữa hai request embedding bất kỳ tối thiểu 5 giây.
- [ ] Cache ngăn embedding lại nội dung không đổi.
- [ ] 385 FAQ approved được nối vào chatbot retrieval.
- [ ] Query embedding được tạo đúng một lần cho mỗi câu hỏi chatbot.
- [ ] Citation hiển thị số văn bản, version, ngày hiệu lực, trang, Điều/Khoản và điểm retrieval.
- [ ] Văn bản hết hiệu lực không được dùng như quy định hiện hành.
- [ ] PDF, Markdown, chunk và vector truy ngược được lẫn nhau.
- [ ] Test OCR/order/chunk/rate/retrieval chạy đạt trước rollout production.
- [ ] Telemetry chứng minh ngoài embedding và final output không có model/API AI call nào khác.

## 12. Thứ tự ưu tiên triển khai

1. Migration metadata và thiết kế trạng thái pipeline.
2. PDF/OCR ordered blocks và canonical Markdown.
3. Semantic chunker pháp quy và provenance.
4. Global embedding limiter, cache, retry và resume.
5. Kết nối FAQ retrieval.
6. Filter hiệu lực/phạm vi và xếp hạng xác định, minh bạch.
7. Citation UI, benchmark và rollout.

Không cần thêm Celery hoặc LangChain ở giai đoạn này. Có thể tái sử dụng worker, Redis, PostgreSQL/pgvector và các repository hiện có; chỉ mở rộng khi tải thực tế chứng minh một process worker không đáp ứng.
