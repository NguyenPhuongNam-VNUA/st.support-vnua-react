import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { questionService, QuestionServiceError } from '@/services/admin/question.service';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof QuestionServiceError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  console.error('Lỗi API câu hỏi:', error);
  return NextResponse.json({ success: false, message: 'Lỗi xử lý câu hỏi' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const params = request.nextUrl.searchParams;
    const result = await questionService.list({
      search: params.get('search') || undefined,
      topic: params.get('topic') || undefined,
      status: params.get('status') || undefined,
      answer:
        params.get('answer') === 'answered' || params.get('answer') === 'unanswered'
          ? (params.get('answer') as 'answered' | 'unanswered')
          : undefined,
      page: Number(params.get('page') || 1),
      limit: Number(params.get('limit') || 20),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const question = await questionService.create(await request.json(), user.id);
    return NextResponse.json(
      { success: true, message: 'Tạo câu hỏi thành công', data: question },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
