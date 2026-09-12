import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/auth/authorization';
import { documentService, DocumentServiceError } from '@/services/admin/document.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAuthenticatedUser(request);
    const url = new URL(
      await documentService.getPublishedSignedFileUrl(Number((await context.params).id))
    );
    const page = Number(request.nextUrl.searchParams.get('page'));
    if (Number.isSafeInteger(page) && page > 0) url.hash = `page=${page}`;
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof DocumentServiceError) {
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
