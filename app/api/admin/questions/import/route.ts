import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { questionService, QuestionServiceError } from '@/services/admin/question.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) {
      throw new QuestionServiceError('Vui lòng chọn file Excel', 422);
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new QuestionServiceError('File Excel phải nhỏ hơn hoặc bằng 2 MB', 413);
    }

    const workbook = new ExcelJS.Workbook();
    const workbookBytes = new Uint8Array(await file.arrayBuffer());
    await workbook.xlsx.load(workbookBytes as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new QuestionServiceError('File Excel không có worksheet', 422);

    const columns = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, columnNumber) => {
      columns.set(cell.text.trim().toLowerCase(), columnNumber);
    });
    const findColumn = (...names: string[]) =>
      names.map((name) => columns.get(name.toLowerCase())).find(Boolean);
    const questionColumn = findColumn('question', 'câu hỏi', 'nội dung câu hỏi');
    const answerColumn = findColumn('answer', 'câu trả lời', 'trả lời');
    const topicColumn = findColumn('topic', 'chủ đề');
    const statusColumn = findColumn('status', 'trạng thái');
    if (!questionColumn) {
      throw new QuestionServiceError('File Excel thiếu cột question hoặc Câu hỏi', 422);
    }

    const rows: Array<Record<string, string>> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || rows.length >= 1000) return;
      const question = row.getCell(questionColumn).text.trim();
      if (!question) return;
      rows.push({
        question,
        answer: answerColumn ? row.getCell(answerColumn).text.trim() : '',
        topic: topicColumn ? row.getCell(topicColumn).text.trim() || 'Khác' : 'Khác',
        status: statusColumn ? row.getCell(statusColumn).text.trim() || 'pending' : 'pending',
      });
    });

    const created = await questionService.createMany(rows, user.id);
    return NextResponse.json({
      success: true,
      message: `Đã nhập ${created.length} câu hỏi`,
      data: { imported: created.length },
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof QuestionServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi import Excel:', error);
    return NextResponse.json({ success: false, message: 'Không thể nhập file Excel' }, { status: 500 });
  }
}
