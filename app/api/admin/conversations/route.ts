import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { conversationRepository } from '@/repositories/admin/conversation.repository';

export const dynamic = 'force-dynamic';

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const params = request.nextUrl.searchParams;
    const limit = Number(params.get('limit') || 500);
    const from = parseDate(params.get('from'));
    const to = parseDate(params.get('to'));
    if (from === undefined || to === undefined) {
      return NextResponse.json({ success: false, message: 'Tham số thời gian không hợp lệ' }, { status: 422 });
    }
    const logs = await conversationRepository.listLogs(limit, { from, to });
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi tải hội thoại:', error);
    return NextResponse.json({ success: false, message: 'Không thể tải nhật ký hội thoại' }, { status: 500 });
  }
}
