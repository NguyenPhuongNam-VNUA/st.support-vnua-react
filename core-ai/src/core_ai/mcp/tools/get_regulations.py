"""MCP Tool: get_regulations.

Public academic regulations and VNUA institutional policy lookup tool for ST-Care.
Provides access to university statutes, grading schemes, academic warnings,
scholarships, and graduation criteria.
"""

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from core_ai.contracts.mcp import ToolDefinition, ToolScope

logger = logging.getLogger("core_ai.mcp.tools.get_regulations")


class GetRegulationsInput(BaseModel):
    """Input payload for regulations lookup."""
    category: str = Field(
        default="all",
        description="Lĩnh vực quy chế: 'dao_tao', 'hoc_phi', 'hoc_bong', 'ren_luyen', 'tot_nghiep', 'ky_tuc_xa', 'all'",
    )
    keywords: Optional[str] = Field(
        default=None,
        description="Từ khóa tra cứu chi tiết (ví dụ: 'điểm liệt', 'thôi học', 'bảo lưu', 'chuẩn đầu ra')",
    )


VNUA_REGULATIONS: List[Dict[str, Any]] = [
    {
        "code": "QC-DT-2024",
        "title": "Quy chế đào tạo đại học chính quy theo hệ thống tín chỉ VNUA",
        "category": "dao_tao",
        "issued_date": "2024-08-15",
        "document_number": "Quyết định số 2145/QĐ-HVN",
        "signer": "Giám đốc Học viện Nông nghiệp Việt Nam",
        "summary": (
            "Quy định toàn diện về tổ chức đào tạo, đăng ký học phần, đánh giá học phần, "
            "thang điểm chữ, cảnh báo học vụ và xét tốt nghiệp đại học."
        ),
        "key_articles": [
            {
                "article": "Điều 14",
                "title": "Thang điểm và đánh giá kết quả học tập",
                "content": (
                    "Đánh giá học phần theo thang điểm 10, quy đổi sang thang điểm chữ (A, B+, B, C+, C, D+, D, F) "
                    "và thang điểm 4. Điểm A: 8.5 - 10.0 (4.0); B+: 8.0 - 8.4 (3.5); B: 7.0 - 7.9 (3.0); "
                    "C+: 6.5 - 6.9 (2.5); C: 5.5 - 6.4 (2.0); D+: 5.0 - 5.4 (1.5); D: 4.0 - 4.9 (1.0); "
                    "F: Dưới 4.0 (0.0). Điểm F phải đăng ký học lại."
                ),
            },
            {
                "article": "Điều 18",
                "title": "Cảnh báo kết quả học tập và buộc thôi học",
                "content": (
                    "Sinh viên bị cảnh báo học vụ nếu ĐTBCTL: dưới 1.20 đối với năm thứ nhất; dưới 1.40 đối với năm hai; "
                    "dưới 1.60 đối với năm ba; dưới 1.80 đối với các năm tiếp theo. "
                    "Sinh viên bị cảnh báo kết quả học tập 3 lần liên tiếp sẽ bị buộc thôi học."
                ),
            },
            {
                "article": "Điều 22",
                "title": "Đăng ký học lại và học cải thiện điểm",
                "content": (
                    "Sinh viên có học phần bị điểm F bắt buộc phải đăng ký học lại ở các học kỳ tiếp theo. "
                    "Sinh viên được phép đăng ký học cải thiện đối với các học phần đạt điểm D, D+, C để nâng cao ĐTBCTL. "
                    "Điểm cao nhất giữa các lần học sẽ được chọn để tính điểm tích lũy."
                ),
            },
        ],
    },
    {
        "code": "QC-HB-2023",
        "title": "Quy chế xét cấp học bổng khuyến khích học tập cho sinh viên VNUA",
        "category": "hoc_bong",
        "issued_date": "2023-10-10",
        "document_number": "Quyết định số 1890/QĐ-HVN",
        "signer": "Phó Giám đốc phụ trách Đào tạo",
        "summary": "Quy định điều kiện, tiêu chuẩn và mức cấp học bổng khuyến khích học tập mỗi kỳ theo Nghị định 84/2020/NĐ-CP.",
        "key_articles": [
            {
                "article": "Điều 4",
                "title": "Mức học bổng và tiêu chuẩn xét duyệt",
                "content": (
                    "Mức Xuất sắc: ĐTB học kỳ từ 3.60 trở lên và Điểm rèn luyện từ 90 trở lên (Mức thưởng: 120% mức trần học phí). "
                    "Mức Giỏi: ĐTB học kỳ từ 3.20 đến 3.59 và Điểm rèn luyện từ 80 đến 89 (Mức thưởng: 100% mức trần học phí). "
                    "Mức Khá: ĐTB học kỳ từ 2.50 đến 3.19 và Điểm rèn luyện từ 70 đến 79 (Mức thưởng: 80% mức trần học phí)."
                ),
            },
            {
                "article": "Điều 6",
                "title": "Các trường hợp không được xét học bổng",
                "content": (
                    "Sinh viên không được xét học bổng trong học kỳ nếu: Có học phần bị điểm F; "
                    "Số tín chỉ đăng ký học trong kỳ ít hơn 14 tín chỉ (trừ kỳ cuối); Bị kỷ luật từ mức khiển trách trở lên."
                ),
            },
        ],
    },
    {
        "code": "QC-TN-2024",
        "title": "Quy định chuẩn đầu ra và điều kiện công nhận tốt nghiệp đại học VNUA",
        "category": "tot_nghiep",
        "issued_date": "2024-05-20",
        "document_number": "Quyết định số 1205/QĐ-HVN",
        "signer": "Giám đốc Học viện Nông nghiệp Việt Nam",
        "summary": "Quy định về chuẩn đầu ra ngoại ngữ, tin học, GDTC, GDQP-AN và điều kiện bảo vệ khóa luận tốt nghiệp.",
        "key_articles": [
            {
                "article": "Điều 5",
                "title": "Chuẩn đầu ra Ngoại ngữ và Tin học",
                "content": (
                    "Chuẩn Ngoại ngữ: Chứng chỉ tiếng Anh TOEIC tối thiểu 450 điểm hoặc B1 theo Khung năng lực ngoại ngữ 6 bậc "
                    "dùng cho Việt Nam (VSTEP), hoặc các chứng chỉ quốc tế tương đương (IELTS 4.5, TOEFL iBT 45). "
                    "Chuẩn Tin học: Chứng chỉ Tin học văn phòng MOS (tối thiểu 700 điểm đối với 2 kỹ năng Word và Excel) "
                    "hoặc Chứng chỉ Ứng dụng CNTT cơ bản theo Chuẩn kỹ năng sử dụng CNTT quy định tại Thông tư 03/2014/TT-BTTTT."
                ),
            },
            {
                "article": "Điều 8",
                "title": "Điều kiện làm khóa luận tốt nghiệp",
                "content": (
                    "Sinh viên được giao làm khóa luận tốt nghiệp khi: Tích lũy đủ số tín chỉ quy định của các học phần tiên quyết; "
                    "ĐTBCTL đạt từ 2.00 trở lên; Không trong thời gian bị kỷ luật từ mức đình chỉ học tập trở lên."
                ),
            },
        ],
    },
    {
        "code": "QC-RL-2023",
        "title": "Quy định đánh giá kết quả rèn luyện của sinh viên VNUA",
        "category": "ren_luyen",
        "issued_date": "2023-09-01",
        "document_number": "Quyết định số 1560/QĐ-HVN",
        "signer": "Giám đốc Học viện Nông nghiệp Việt Nam",
        "summary": "Quy định khung điểm đánh giá rèn luyện theo 5 tiêu chí với thang điểm 100.",
        "key_articles": [
            {
                "article": "Điều 7",
                "title": "Phân loại kết quả rèn luyện",
                "content": (
                    "Từ 90 đến 100 điểm: Xuất sắc; Từ 80 đến 89 điểm: Tốt; Từ 65 đến 79 điểm: Khá; "
                    "Từ 50 đến 64 điểm: Trung bình; Từ 35 đến 49 điểm: Yếu; Dưới 35 điểm: Kém. "
                    "Sinh viên xếp loại rèn luyện Yếu, Kém trong hai học kỳ liên tiếp sẽ bị xem xét tạm ngừng học tập."
                ),
            },
        ],
    },
]

TOOL_DEFINITION = ToolDefinition(
    name="get_regulations",
    description=(
        "Tra cứu các văn bản quy chế, quy định học vụ, thang điểm, cảnh báo kết quả học tập, "
        "tiêu chuẩn học bổng khuyến khích và chuẩn đầu ra tốt nghiệp tại VNUA."
    ),
    scope=ToolScope.PUBLIC,
    input_schema={
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "description": "Lĩnh vực: 'dao_tao', 'hoc_phi', 'hoc_bong', 'ren_luyen', 'tot_nghiep', 'ky_tuc_xa', 'all'",
                "default": "all",
            },
            "keywords": {
                "type": "string",
                "description": "Từ khóa tra cứu chi tiết (ví dụ: 'thang điểm', 'cảnh báo', 'học bổng', 'chuẩn đầu ra')",
            },
        },
    },
    output_schema={
        "type": "object",
        "properties": {
            "category_filter": {"type": "string"},
            "total_matches": {"type": "integer"},
            "regulations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "code": {"type": "string"},
                        "title": {"type": "string"},
                        "category": {"type": "string"},
                        "document_number": {"type": "string"},
                        "summary": {"type": "string"},
                        "key_articles": {"type": "array"},
                    },
                },
            },
        },
    },
    timeout_seconds=3.0,
    requires_approval=False,
)


async def execute_get_regulations(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieves academic regulations filtered by category and keyword matching."""
    input_model = GetRegulationsInput(**arguments)
    category_filter = input_model.category.lower().strip()
    keywords_clean = input_model.keywords.lower().strip() if input_model.keywords else None

    matched_regs: List[Dict[str, Any]] = []

    for reg in VNUA_REGULATIONS:
        # Category filter
        if category_filter not in ("all", "") and reg["category"].lower() != category_filter:
            continue

        # Keyword filter if provided
        if keywords_clean:
            kw_tokens = keywords_clean.split()
            text_to_search = (
                f"{reg['title']} {reg['summary']} "
                + " ".join(f"{a['title']} {a['content']}" for a in reg.get("key_articles", []))
            ).lower()

            if not any(token in text_to_search for token in kw_tokens):
                continue

        matched_regs.append(reg)

    logger.info(
        "get_regulations category='%s' keywords='%s' matched %d regulations",
        category_filter,
        keywords_clean,
        len(matched_regs),
    )

    return {
        "category_filter": category_filter,
        "keywords": keywords_clean,
        "total_matches": len(matched_regs),
        "regulations": matched_regs,
    }
