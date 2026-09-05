import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const supabase = getSupabaseAdmin();

    // 1. Get real DB counts concurrently
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [chunksRes, activeDocsRes, activeSessionsRes, totalConvsRes] = await Promise.all([
      supabase.from('document_chunks').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).gte('started_at', oneDayAgo),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
    ]);

    // 2. Probe Core AI engine health and measure roundtrip latency
    const pythonBaseUrl = process.env.PYTHON_AGENT_BASE_URL || 'http://127.0.0.1:5001';
    let agentStatus: 'online' | 'degraded' | 'offline' = 'offline';
    let latencyMs = 0;

    const probeStart = Date.now();
    try {
      const probeRes = await fetch(`${pythonBaseUrl.replace(/\/$/, '')}/health/live`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      latencyMs = Date.now() - probeStart;
      if (probeRes.ok) {
        agentStatus = 'online';
      } else {
        agentStatus = 'degraded';
      }
    } catch {
      latencyMs = 0;
      agentStatus = 'offline';
    }

    return NextResponse.json({
      success: true,
      data: {
        agent_status: agentStatus,
        latency_ms: latencyMs,
        vector_chunks: chunksRes.count || 0,
        active_documents: activeDocsRes.count || 0,
        active_sessions: activeSessionsRes.count || 0,
        total_conversations: totalConvsRes.count || 0,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Lỗi khi lấy thông số hệ thống:', error);
    return NextResponse.json({ success: false, message: 'Không thể lấy thông số hệ thống' }, { status: 500 });
  }
}
