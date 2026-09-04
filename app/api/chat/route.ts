import { NextRequest, NextResponse } from 'next/server';
import { AiAgentError, callAiAgent } from '@/lib/ai/agent-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 4000) {
      return NextResponse.json(
        { success: false, message: 'Câu hỏi phải từ 1 đến 4000 ký tự' },
        { status: 422 }
      );
    }

    const requestId = crypto.randomUUID();
    const tenantId = process.env.CORE_AI_TENANT_ID || 'vnua';
    const upstream = await callAiAgent(
      '/v1/chat',
      {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        body: JSON.stringify({
          message: question,
          conversation_id: body?.conversation_id,
          locale: 'vi-VN',
          channel: 'web',
          requested_tool: body?.requested_tool,
          tool_arguments: body?.tool_arguments || {},
          tool_approved: body?.tool_approved === true,
        }),
      },
      { requestId, tenantId }
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Request-ID': upstream.headers.get('x-request-id') || requestId,
      },
    });
  } catch (error) {
    if (error instanceof AiAgentError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi gateway AI:', error);
    return NextResponse.json({ success: false, message: 'AI Agent tạm thời không khả dụng' }, { status: 502 });
  }
}
