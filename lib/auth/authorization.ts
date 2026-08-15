import { NextRequest } from 'next/server';
import { authService, AuthServiceError, AuthSessionUser } from '@/services/auth/auth.service';
import { AccountRole, AUTH_COOKIE_NAME, verifyAccessToken } from './jwt';

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

function extractToken(request: NextRequest): string | null {
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim() || null;
  }

  return null;
}

export async function requireAuthenticatedUser(request: NextRequest): Promise<AuthSessionUser> {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      throw new AuthorizationError('Nguồn yêu cầu không hợp lệ', 403);
    }
  }

  const token = extractToken(request);
  if (!token) {
    throw new AuthorizationError('Bạn chưa đăng nhập', 401);
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw new AuthorizationError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
  }

  const userId = Number(claims.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AuthorizationError('Phiên đăng nhập không hợp lệ', 401);
  }

  let user: AuthSessionUser;
  try {
    user = await authService.getCurrentUser(userId);
  } catch (error) {
    if (error instanceof AuthServiceError && error.statusCode === 403) {
      throw new AuthorizationError(error.message, 403);
    }
    throw new AuthorizationError('Tài khoản không còn tồn tại hoặc phiên đã bị thu hồi', 401);
  }

  if (claims.role !== user.role) {
    throw new AuthorizationError('Quyền tài khoản đã thay đổi, vui lòng đăng nhập lại', 401);
  }

  return user;
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: readonly AccountRole[]
): Promise<AuthSessionUser> {
  const user = await requireAuthenticatedUser(request);
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError('Bạn không có quyền thực hiện thao tác này', 403);
  }
  return user;
}

export function getAuthorizationErrorStatus(error: unknown): 401 | 403 | null {
  return error instanceof AuthorizationError ? error.statusCode : null;
}
