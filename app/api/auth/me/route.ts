import { NextRequest, NextResponse } from 'next/server';
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/lib/auth/authorization';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    return NextResponse.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Lỗi trong GET /api/auth/me:', error);
    return NextResponse.json(
      { success: false, message: 'Không thể lấy thông tin phiên đăng nhập' },
      { status: 500 }
    );
  }
}
