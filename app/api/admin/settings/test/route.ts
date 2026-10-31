import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { AiAgentError, callAiAgent } from '@/lib/ai/agent-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const body = await request.json();
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    if (!model) {
      return NextResponse.json({ success: false, message: 'Thiếu tên model' }, { status: 422 });
    }
    const upstream = await callAiAgent(
      '/api/v1/agent-settings/test-model',
      { method: 'POST', body: JSON.stringify({ model }) },
      { requestId: crypto.randomUUID(), tenantId: process.env.CORE_AI_TENANT_ID || 'vnua', userId: user.id }
    );
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, message: data?.detail || 'Core AI từ chối yêu cầu' },
        { status: upstream.status }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof AiAgentError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: 'Không kết nối được Core AI' }, { status: 502 });
  }
}
