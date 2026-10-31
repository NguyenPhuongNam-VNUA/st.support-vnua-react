import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';
import { AiAgentError, callAiAgent } from '@/lib/ai/agent-client';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const FIELDS = 'system_prompt, llm_model, temperature, evidence_low_threshold, updated_at';
const MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,120}$/;

function tenantId() {
  return process.env.CORE_AI_TENANT_ID || 'vnua';
}

class SettingsError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof SettingsError || error instanceof AiAgentError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  console.error('Lỗi API cấu hình agent:', error);
  return NextResponse.json({ success: false, message: 'Lỗi xử lý cấu hình agent' }, { status: 500 });
}

// Empty string / null clears an override so core-ai falls back to its .env default.
function optionalNumber(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new SettingsError(`${label} phải nằm trong khoảng ${min}–${max}`);
  }
  return Math.round(num * 100) / 100;
}

function parseBody(body: Record<string, unknown>) {
  const prompt = typeof body.system_prompt === 'string' ? body.system_prompt.trim() : '';
  if (prompt.length > 8000) throw new SettingsError('System prompt tối đa 8000 ký tự');
  const model = typeof body.llm_model === 'string' ? body.llm_model.trim() : '';
  if (model && !MODEL_PATTERN.test(model)) throw new SettingsError('Tên model không hợp lệ');
  return {
    system_prompt: prompt || null,
    llm_model: model || null,
    temperature: optionalNumber(body.temperature, 0, 1, 'Temperature'),
    evidence_low_threshold: optionalNumber(body.evidence_low_threshold, 0.3, 0.75, 'Ngưỡng bằng chứng'),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const [{ data, error }, defaultsRes] = await Promise.all([
      getSupabaseAdmin().from('agent_settings').select(FIELDS).eq('tenant_id', tenantId()).maybeSingle(),
      callAiAgent('/api/v1/agent-settings/defaults', { method: 'GET' }, {
        requestId: crypto.randomUUID(),
        tenantId: tenantId(),
        userId: user.id,
      }).catch(() => null),
    ]);
    if (error) throw new SettingsError('Chưa đọc được bảng agent_settings. Hãy chạy migration.', 500);
    const defaults = defaultsRes?.ok ? await defaultsRes.json() : null;
    return NextResponse.json({ success: true, data: { overrides: data, defaults } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(request, ['admin']);
    const values = parseBody(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('agent_settings')
      .upsert({
        tenant_id: tenantId(),
        ...values,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select(FIELDS)
      .single();
    if (error) throw new SettingsError('Không lưu được cấu hình agent', 500);
    return NextResponse.json({ success: true, message: 'Đã lưu cấu hình', data });
  } catch (error) {
    return errorResponse(error);
  }
}
