import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { AiAgentError, callAiAgent } from '@/lib/ai/agent-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const topK = Math.min(10, Math.max(1, Number(body?.top_k) || 3));
    if (query.length < 2 || query.length > 1000) {
      return NextResponse.json(
        { success: false, message: 'Câu hỏi test phải từ 2 đến 1000 ký tự' },
        { status: 422 }
      );
    }

    const upstream = await callAiAgent(
      '/api/v1/retrieval/test',
      { method: 'POST', body: JSON.stringify({ query, top_k: topK }) },
      {
        requestId: crypto.randomUUID(),
        tenantId: process.env.CORE_AI_TENANT_ID || 'vnua',
        userId: user.id,
      }
    );
    if (!upstream.ok) {
      throw new AiAgentError('AI Agent không thực hiện được truy xuất thử', upstream.status);
    }

    return NextResponse.json({ success: true, data: await upstream.json() });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof AiAgentError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi test retrieval:', error);
    return NextResponse.json({ success: false, message: 'Không thể chạy thử truy xuất' }, { status: 502 });
  }
}
