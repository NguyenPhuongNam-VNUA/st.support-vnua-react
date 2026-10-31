import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export interface AdminNotification {
  id: string;
  type: 'question' | 'alert' | 'feedback' | 'document';
  title: string;
  desc: string;
  link: string;
  created_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const truncate = (text: string, max = 90) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const supabase = getSupabaseAdmin();
    const dayAgo = new Date(Date.now() - DAY_MS).toISOString();
    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();

    const [pendingRes, botRes, fallbackRes, dislikeRes, docsRes] = await Promise.all([
      supabase
        .from('questions')
        .select('id, question, created_at', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender', 'bot')
        .gte('created_at', dayAgo),
      supabase
        .from('messages')
        .select('id, created_at', { count: 'exact' })
        .eq('sender', 'bot')
        .eq('status', 'not_found')
        .gte('created_at', dayAgo)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('messages')
        .select('id, content, created_at', { count: 'exact' })
        .eq('sender', 'bot')
        .eq('feedback', 'dislike')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('documents')
        .select('id, title, pipeline_stage, updated_at')
        .in('pipeline_stage', ['ready', 'error', 'needs_review'])
        .gte('updated_at', weekAgo)
        .order('updated_at', { ascending: false })
        .limit(5),
    ]);

    const firstError = [pendingRes, botRes, fallbackRes, dislikeRes, docsRes].find((res) => res.error)?.error;
    if (firstError) throw new Error(firstError.message);

    const notifications: AdminNotification[] = [];

    const pendingCount = pendingRes.count || 0;
    const latestPending = pendingRes.data?.[0];
    if (pendingCount > 0 && latestPending) {
      notifications.push({
        id: `pending-questions:${latestPending.id}:${pendingCount}`,
        type: 'question',
        title: `Có ${pendingCount} câu hỏi chờ duyệt`,
        desc: `Mới nhất: "${truncate(latestPending.question || '')}"`,
        link: '/admin/questions',
        created_at: latestPending.created_at,
      });
    }

    const fallbackCount = fallbackRes.count || 0;
    const botCount = botRes.count || 0;
    const latestFallback = fallbackRes.data?.[0];
    if (fallbackCount > 0 && latestFallback) {
      const rate = botCount > 0 ? ((fallbackCount / botCount) * 100).toFixed(1) : '100';
      notifications.push({
        id: `fallback:${latestFallback.id}`,
        type: 'alert',
        title: `${fallbackCount} câu hỏi Agent chưa trả lời được`,
        desc: `Tỷ lệ fallback ${rate}% trên ${botCount} câu trả lời trong 24 giờ qua.`,
        link: '/admin/training',
        created_at: latestFallback.created_at,
      });
    }

    const dislikeCount = dislikeRes.count || 0;
    const latestDislike = dislikeRes.data?.[0];
    if (dislikeCount > 0 && latestDislike) {
      notifications.push({
        id: `dislike:${latestDislike.id}`,
        type: 'feedback',
        title: `${dislikeCount} câu trả lời bị đánh giá chưa tốt`,
        desc: `Gần nhất: "${truncate(latestDislike.content || '')}"`,
        link: '/admin/conversations',
        created_at: latestDislike.created_at,
      });
    }

    const stageText: Record<string, { title: string; desc: string }> = {
      ready: { title: 'Tài liệu đã sẵn sàng cho RAG', desc: 'đã embedding xong và có thể dùng để trả lời.' },
      needs_review: { title: 'Tài liệu cần duyệt nội dung', desc: 'đã tách nội dung, chờ quản trị viên kiểm tra.' },
      error: { title: 'Xử lý tài liệu bị lỗi', desc: 'gặp lỗi trong pipeline, cần kiểm tra và chạy lại.' },
    };
    for (const doc of docsRes.data || []) {
      const text = stageText[doc.pipeline_stage];
      if (!text) continue;
      notifications.push({
        id: `document:${doc.id}:${doc.pipeline_stage}:${doc.updated_at}`,
        type: doc.pipeline_stage === 'error' ? 'alert' : 'document',
        title: text.title,
        desc: `"${truncate(doc.title || 'Tài liệu', 60)}" ${text.desc}`,
        link: '/admin/documents',
        created_at: doc.updated_at,
      });
    }

    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi tải thông báo:', error);
    return NextResponse.json({ success: false, message: 'Không thể tải thông báo' }, { status: 500 });
  }
}
