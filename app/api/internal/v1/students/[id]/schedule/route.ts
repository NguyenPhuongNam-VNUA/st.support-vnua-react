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
  const weekRaw = request.nextUrl.searchParams.get('week');
  const week = weekRaw == null ? null : Number(weekRaw);
  const dayRaw = request.nextUrl.searchParams.get('day_of_week');
  const day = dayRaw == null ? null : Number(dayRaw);
  if ((week != null && (!Number.isInteger(week) || week < 1 || week > 53)) || (day != null && (!Number.isInteger(day) || day < 1 || day > 7))) {
    return NextResponse.json({ success: false, code: 'invalid_period' }, { status: 422 });
  }

  let query = getSupabaseAdmin()
    .from('student_schedule_entries')
    .select('semester, week, day_of_week, starts_at, ends_at, course_code, course_name, room, event_type, source_system, source_updated_at')
    .eq('tenant_id', context.tenantId)
    .eq('account_id', context.accountId)
    .order('starts_at', { ascending: true })
    .limit(100);
  if (semester) query = query.eq('semester', semester.slice(0, 40));
  if (week != null) query = query.eq('week', week);
  if (day != null) query = query.eq('day_of_week', day);
  const { data, error } = await query;
  if (error) {
    console.error('Internal schedule lookup failed:', error.code);
    return NextResponse.json({ success: false, code: 'unavailable' }, { status: 503 });
  }
  if (!data?.length) return NextResponse.json({ success: false, code: 'not_found', entries: [] }, { status: 404 });
  return NextResponse.json({ success: true, entries: data, authoritative: true });
}
