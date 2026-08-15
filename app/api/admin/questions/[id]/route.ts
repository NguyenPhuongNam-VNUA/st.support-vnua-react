import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { questionService, QuestionServiceError } from '@/services/admin/question.service';

interface RouteContext { params: Promise<{ id: string }> }

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof QuestionServiceError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  return NextResponse.json({ success: false, message: 'Lỗi xử lý câu hỏi' }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    return NextResponse.json({
      success: true,
      data: await questionService.getById(Number((await context.params).id)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole(request, ['admin']);
    const question = await questionService.update(
      Number((await context.params).id),
      await request.json(),
      user.id
    );
    return NextResponse.json({ success: true, message: 'Cập nhật câu hỏi thành công', data: question });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole(request, ['admin']);
    await questionService.deleteMany([Number((await context.params).id)], user.id);
    return NextResponse.json({ success: true, message: 'Xóa câu hỏi thành công' });
  } catch (error) {
    return errorResponse(error);
  }
}
