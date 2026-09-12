import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { questionService, QuestionServiceError } from '@/services/admin/question.service';

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof QuestionServiceError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  return NextResponse.json({ success: false, message: 'Lỗi xử lý hàng loạt' }, { status: 500 });
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const body = await request.json();
    const questions = await questionService.bulkUpdate(body, user.id);
    const message = body?.status === 'approved'
      ? 'Đã xếp hàng embedding; từng câu hỏi sẽ được duyệt sau khi tạo vector thành công'
      : 'Cập nhật hàng loạt thành công';
    return NextResponse.json({ success: true, message, data: questions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const body = await request.json();
    await questionService.deleteMany(body?.ids, user.id);
    return NextResponse.json({ success: true, message: 'Xóa hàng loạt thành công' });
  } catch (error) {
    return errorResponse(error);
  }
}
