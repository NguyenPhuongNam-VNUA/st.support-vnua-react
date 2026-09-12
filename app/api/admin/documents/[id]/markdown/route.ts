import { NextRequest } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { AiAgentError, callAiAgent } from '@/lib/ai/agent-client';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const markdown = await documentService.getMarkdown(Number((await context.params).id));
    if (request.nextUrl.searchParams.get('format') === 'json') {
      return Response.json({ success: true, data: markdown });
    }
    const fallbackName = `document-${markdown.id}`;
    const baseName = String(markdown.document_number || markdown.title || fallbackName)
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || fallbackName;

    return new Response(markdown.markdown_content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.md"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof DocumentServiceError) {
      return Response.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Lỗi tải Markdown tài liệu:', error);
    return Response.json(
      { success: false, message: 'Không thể tải Markdown' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let documentId = 0;
  try {
    const user = await requireRole(request, ['admin']);
    documentId = Number((await context.params).id);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DocumentServiceError('Dữ liệu JSON không hợp lệ', 422);
    }
    const result = await documentService.saveMarkdown(documentId, body);
    if (!result.changed) {
      return Response.json({
        success: true,
        message: 'Nội dung Markdown không thay đổi',
        data: result.document,
      });
    }

    const upstream = await callAiAgent(
      '/documents/reindex-markdown',
      {
        method: 'POST',
        body: JSON.stringify({ document_id: documentId }),
      },
      {
        requestId: crypto.randomUUID(),
        tenantId: process.env.CORE_AI_TENANT_ID || 'vnua',
        userId: user.id,
      }
    );
    if (!upstream.ok) {
      throw new AiAgentError('AI Agent từ chối yêu cầu tái lập chỉ mục Markdown', upstream.status);
    }

    return Response.json({
      success: true,
      message: 'Đã cập nhật Markdown và bắt đầu embedding lại nội dung thay đổi',
      data: await documentService.getById(documentId),
    });
  } catch (error) {
    if (documentId > 0 && error instanceof AiAgentError) {
      await documentService.update(documentId, { pipeline_stage: 'error', progress: 0 }).catch(() => undefined);
    }
    if (
      error instanceof AuthorizationError ||
      error instanceof DocumentServiceError ||
      error instanceof AiAgentError
    ) {
      return Response.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Lỗi cập nhật Markdown tài liệu:', error);
    return Response.json(
      { success: false, message: 'Không thể cập nhật Markdown' },
      { status: 500 }
    );
  }
}
