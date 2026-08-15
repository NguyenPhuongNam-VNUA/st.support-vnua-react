import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { questionService } from '@/services/admin/question.service';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    return NextResponse.json({ success: true, data: await questionService.getTopQuestions() });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: 'Không thể tải top câu hỏi' }, { status: 500 });
  }
}
