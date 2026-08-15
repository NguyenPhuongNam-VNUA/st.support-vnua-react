import { NextRequest, NextResponse } from 'next/server';
import { authService, AuthServiceError } from '@/services/auth/auth.service';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, user } = await authService.login(body);

    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: { user },
    });
    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, errors: error.errors },
        { status: error.statusCode }
      );
    }

    console.error('Lỗi trong POST /api/auth/login:', error);
    return NextResponse.json(
      { success: false, message: 'Không thể đăng nhập vào lúc này' },
      { status: 500 }
    );
  }
}
