import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { questionService, QuestionServiceError } from '@/services/admin/question.service';

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const logs = await questionService.getAuditLogs(Number((await context.params).id));
    return NextResponse.json({ success: true, data: { logs } });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof QuestionServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: 'Không thể tải audit log' }, { status: 500 });
  }
}
