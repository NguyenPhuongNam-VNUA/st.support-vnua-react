import { NextRequest } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const markdown = await documentService.getMarkdown(Number((await context.params).id));
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
