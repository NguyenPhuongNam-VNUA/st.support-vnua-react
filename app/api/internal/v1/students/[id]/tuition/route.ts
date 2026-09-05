import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { getTrustedBusinessContext, isBusinessError } from '@/lib/internal/business-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = getTrustedBusinessContext(request, id);
  if (isBusinessError(context)) return context;
  const semester = request.nextUrl.searchParams.get('semester')?.trim();
  let query = getSupabaseAdmin()
    .from('student_tuition_entries')
    .select('semester, item_code, description, amount_due, amount_paid, due_date, currency, source_system, source_updated_at')
    .eq('tenant_id', context.tenantId)
    .eq('account_id', context.accountId)
    .order('due_date', { ascending: true })
    .limit(100);
  if (semester) query = query.eq('semester', semester.slice(0, 40));
  const { data, error } = await query;
  if (error) {
    console.error('Internal tuition lookup failed:', error.code);
    return NextResponse.json({ success: false, code: 'unavailable' }, { status: 503 });
  }
  if (!data?.length) return NextResponse.json({ success: false, code: 'not_found', entries: [] }, { status: 404 });
  const totals = data.reduce(
    (value, row) => ({
      due: value.due + Number(row.amount_due || 0),
      paid: value.paid + Number(row.amount_paid || 0),
    }),
    { due: 0, paid: 0 }
  );
  return NextResponse.json({
    success: true,
    entries: data,
    totals: { ...totals, outstanding: Math.max(0, totals.due - totals.paid), currency: data[0].currency },
    authoritative: true,
  });
}
