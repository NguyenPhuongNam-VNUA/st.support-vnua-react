import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Like/dislike for a bot answer. Chat is open to anonymous users, so the random
 * conversation UUID kept in the browser is what proves the caller owns the chat.
 * core-ai stores that UUID as conversations.session_id when it persists a turn.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id.trim() : '';
    const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
    const feedback = body?.feedback === 'like' || body?.feedback === 'dislike' ? body.feedback : null;

    if (!UUID_RE.test(conversationId) || !answer || answer.length > 20000) {
      return NextResponse.json({ success: false, message: 'Dữ liệu đánh giá không hợp lệ' }, { status: 422 });
    }
    if (body?.feedback !== null && feedback === null) {
      return NextResponse.json({ success: false, message: 'Đánh giá chỉ nhận like, dislike hoặc null' }, { status: 422 });
    }

    const supabase = getSupabaseAdmin();
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('session_id', conversationId)
      .order('started_at', { ascending: false })
      .limit(5);
    if (convError) throw new Error(convError.message);

    const conversationIds = (conversations || []).map((row) => row.id);
    if (conversationIds.length === 0) {
      return NextResponse.json({ success: false, code: 'not_persisted', message: 'Câu trả lời chưa được lưu' }, { status: 404 });
    }

    const { data: botMessages, error: msgError } = await supabase
      .from('messages')
      .select('id, content')
      .in('conversation_id', conversationIds)
      .eq('sender', 'bot')
      .order('created_at', { ascending: false })
      .limit(100);
    if (msgError) throw new Error(msgError.message);

    // shortcut: identical answer texts in one chat resolve to the newest one; store a message id in the SSE payload if that matters.
    const target = (botMessages || []).find((row) => (row.content || '').trim() === answer);
    if (!target) {
      return NextResponse.json({ success: false, code: 'not_persisted', message: 'Câu trả lời chưa được lưu' }, { status: 404 });
    }

    const { error: updateError } = await supabase.from('messages').update({ feedback }).eq('id', target.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true, data: { feedback } });
  } catch (error) {
    console.error('Lỗi lưu đánh giá câu trả lời:', error);
    return NextResponse.json({ success: false, message: 'Không thể lưu đánh giá' }, { status: 500 });
  }
}
