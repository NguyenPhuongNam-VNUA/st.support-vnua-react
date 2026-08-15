import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { AiAgentError, callAiAgent } from '@/lib/ai/agent-client';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const id = Number((await context.params).id);
    const document = await documentService.getById(id);
    const fileUrl = await documentService.getSignedFileUrl(id);

    const upstream = await callAiAgent('/documents/embed', {
      method: 'POST',
      body: JSON.stringify({ document_id: document.id, file_url: fileUrl }),
    });
    if (!upstream.ok) {
      throw new AiAgentError('AI Agent từ chối yêu cầu embedding', upstream.status);
    }

    const updated = await documentService.update(id, { pipeline_stage: 'embedding', progress: 0 });
    return NextResponse.json({ success: true, message: 'Đã gửi tài liệu sang pipeline AI', data: updated });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof DocumentServiceError ||
      error instanceof AiAgentError
    ) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: 'Không thể khởi chạy embedding' }, { status: 500 });
  }
}
