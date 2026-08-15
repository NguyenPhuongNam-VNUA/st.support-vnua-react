import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAccessToken } from '@/lib/auth/jwt';

function unauthorized(request: NextRequest, status: 401 | 403, message: string) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, message }, { status });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('reason', status === 403 ? 'forbidden' : 'unauthorized');
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorized(request, 401, 'Bạn chưa đăng nhập');

  try {
    const claims = await verifyAccessToken(token);
    if (claims.role !== 'admin') {
      return unauthorized(request, 403, 'Bạn không có quyền truy cập khu vực quản trị');
    }
    return NextResponse.next();
  } catch {
    const response = unauthorized(request, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
