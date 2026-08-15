import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { conversationRepository } from '@/repositories/admin/conversation.repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const limit = Number(request.nextUrl.searchParams.get('limit') || 500);
    const logs = await conversationRepository.listLogs(limit);
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi tải hội thoại:', error);
    return NextResponse.json({ success: false, message: 'Không thể tải nhật ký hội thoại' }, { status: 500 });
  }
}
