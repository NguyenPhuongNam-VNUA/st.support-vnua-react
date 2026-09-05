import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface TrustedBusinessContext {
  tenantId: string;
  accountId: number;
  requestId: string | null;
}

export function getTrustedBusinessContext(
  request: NextRequest,
  routeAccountId?: string
): TrustedBusinessContext | NextResponse {
  const expected = process.env.BUSINESS_API_TOKEN || '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return NextResponse.json({ success: false, code: 'unauthorized', message: 'Unauthorized internal service' }, { status: 401 });
  }
  const tenantId = request.headers.get('x-tenant-id')?.trim() || '';
  const headerAccountId = request.headers.get('x-user-id')?.trim() || '';
  const accountId = Number(headerAccountId);
  if (
    !/^[a-z0-9_-]{1,64}$/i.test(tenantId)
    || !Number.isSafeInteger(accountId)
    || accountId <= 0
    || (routeAccountId != null && routeAccountId !== headerAccountId)
  ) {
    return NextResponse.json({ success: false, code: 'invalid_context', message: 'Invalid trusted context' }, { status: 422 });
  }
  return { tenantId, accountId, requestId: request.headers.get('x-request-id') };
}

export function isBusinessError(value: TrustedBusinessContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
