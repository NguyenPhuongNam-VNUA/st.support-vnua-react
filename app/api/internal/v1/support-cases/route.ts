import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const expected = process.env.BUSINESS_API_TOKEN || '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized internal service' }, { status: 401 });
  }
  const tenantId = request.headers.get('x-tenant-id')?.trim() || '';
  const rawUserId = request.headers.get('x-user-id')?.trim() || '';
  const accountId = Number(rawUserId);
  if (!/^[a-z0-9_-]{1,64}$/i.test(tenantId) || !Number.isSafeInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid trusted context' }, { status: 422 });
  }

  const body = await request.json();
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 80) : '';
  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 4000) : '';
  if (category.length < 2 || subject.length < 5 || details.length < 10) {
    return NextResponse.json({ success: false, message: 'Invalid support case payload' }, { status: 422 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('support_cases')
    .insert({
      tenant_id: tenantId,
      account_id: accountId,
      category,
      subject,
      details,
      priority: ['low', 'normal', 'high', 'urgent'].includes(body?.priority) ? body.priority : 'normal',
      conversation_id: body?.conversation_id == null ? null : String(body.conversation_id).slice(0, 128),
      status: 'open',
    })
    .select('id, status, created_at')
    .single();
  if (error) {
    console.error('Internal support case insert failed:', error.code);
    return NextResponse.json({ success: false, message: 'Could not create support case' }, { status: 500 });
  }
  return NextResponse.json({ ticket_id: `CASE-${data.id}`, status: data.status, created_at: data.created_at }, { status: 201 });
}
