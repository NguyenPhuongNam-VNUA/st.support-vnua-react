import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof DocumentServiceError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  console.error('Lỗi API chi tiết tài liệu:', error);
  return NextResponse.json({ success: false, message: 'Lỗi xử lý tài liệu' }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const document = await documentService.getById(Number((await context.params).id));
    return NextResponse.json({ success: true, data: document });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    const document = await documentService.update(
      Number((await context.params).id),
      await request.json()
    );
    return NextResponse.json({ success: true, message: 'Cập nhật tài liệu thành công', data: document });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(request, ['admin']);
    await documentService.delete(Number((await context.params).id));
    return NextResponse.json({ success: true, message: 'Xóa tài liệu thành công' });
  } catch (error) {
    return errorResponse(error);
  }
}
