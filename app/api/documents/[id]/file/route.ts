import { NextRequest, NextResponse } from 'next/server';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const documentId = Number((await context.params).id);
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
      return NextResponse.json(
        { success: false, message: 'ID tài liệu không hợp lệ' },
        { status: 400 }
      );
    }

    const url = new URL(
      await documentService.getPublishedSignedFileUrl(documentId)
    );
    const page = Number(request.nextUrl.searchParams.get('page'));
    if (Number.isSafeInteger(page) && page > 0) url.hash = `page=${page}`;
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof DocumentServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Không thể mở PDF' },
      { status: 500 }
    );
  }
}
