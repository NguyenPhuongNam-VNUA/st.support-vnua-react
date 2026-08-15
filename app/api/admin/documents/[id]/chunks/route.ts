import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const chunks = await documentService.listChunks(Number((await context.params).id));
    return NextResponse.json({ success: true, data: { chunks } });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof DocumentServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: 'Không thể tải chunks' }, { status: 500 });
  }
}
