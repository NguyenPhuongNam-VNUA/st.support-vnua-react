import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof DocumentServiceError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  console.error('Lỗi API tài liệu:', error);
  return NextResponse.json({ success: false, message: 'Lỗi xử lý tài liệu' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const params = request.nextUrl.searchParams;
    const result = await documentService.list({
      search: params.get('search') || undefined,
      stage: params.get('stage') || undefined,
      active: params.has('active') ? params.get('active') === 'true' : undefined,
      page: Number(params.get('page') || 1),
      limit: Number(params.get('limit') || 24),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const document = await documentService.upload(await request.formData(), user.id);
    return NextResponse.json(
      { success: true, message: 'Tải tài liệu lên thành công', data: document },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
