import type { JWTPayload } from 'jose';
import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';

export const AUTH_COOKIE_NAME = 'st_session';
export const AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;

const JWT_ALGORITHM = 'HS256';
const DEFAULT_ISSUER = 'st-care';
const DEFAULT_AUDIENCE = 'st-care-web';

export type AccountRole = 'admin' | 'student';

export interface AuthTokenClaims extends JWTPayload {
  sub: string;
  role: AccountRole;
  token_use: 'access';
}

function getJwtSecret(): Uint8Array {
  const rawSecret = process.env.JWT_SECRET;
  if (!rawSecret) {
    throw new Error('Thiếu biến môi trường JWT_SECRET');
  }

  const secret = new TextEncoder().encode(rawSecret);
  if (secret.byteLength < 32) {
    throw new Error('JWT_SECRET phải có độ dài tối thiểu 32 byte');
  }

  return secret;
}

function getIssuer() {
  return process.env.JWT_ISSUER || DEFAULT_ISSUER;
}

function getAudience() {
  return process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE;
}

function isAccountRole(value: unknown): value is AccountRole {
  return value === 'admin' || value === 'student';
}

export async function signAccessToken(input: {
  userId: number;
  role: AccountRole;
}): Promise<string> {
  return new SignJWT({ role: input.role, token_use: 'access' })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
    .setSubject(String(input.userId))
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthTokenClaims> {
  const { payload, protectedHeader } = await jwtVerify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
    issuer: getIssuer(),
    audience: getAudience(),
    requiredClaims: ['sub', 'iat', 'exp', 'jti'],
  });

  if (
    protectedHeader.alg !== JWT_ALGORITHM ||
    typeof payload.sub !== 'string' ||
    !isAccountRole(payload.role) ||
    payload.token_use !== 'access'
  ) {
    throw new Error('JWT có claims không hợp lệ');
  }

  return payload as AuthTokenClaims;
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: AUTH_TOKEN_TTL_SECONDS,
  };
}
