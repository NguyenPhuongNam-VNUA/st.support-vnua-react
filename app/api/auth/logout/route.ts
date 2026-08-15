import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/lib/auth/jwt';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Đăng xuất thành công',
  });

  response.cookies.set(AUTH_COOKIE_NAME, '', {
    ...getAuthCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
