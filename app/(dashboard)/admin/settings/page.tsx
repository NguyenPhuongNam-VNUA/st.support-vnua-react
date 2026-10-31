'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Slider,
  Divider,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { Save, CheckCircle2, Zap, AlertTriangle, RotateCcw } from 'lucide-react';
import { ConfigurationPlaybook1Icon } from '@/components/icons/SidebarIcons';
import settingsApi from '@/api/admin/settingsApi';

interface AgentDefaults {
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  temperature: number;
  evidence_low_threshold: number;
  evidence_high_threshold: number;
  embedding_model: string;
  api_key_configured: boolean;
}

interface AgentOverrides {
  system_prompt: string | null;
  llm_model: string | null;
  temperature: number | string | null;
  evidence_low_threshold: number | string | null;
  updated_at: string;
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.875rem',
    bgcolor: '#f8f8f8',
    '& fieldset': { borderColor: 'rgba(0, 0, 0, 0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(0, 0, 0, 0.12)' },
    '&.Mui-focused fieldset': { borderColor: '#1f2937' },
  },
};

const sliderSx = {
  color: '#1f2937',
  '& .MuiSlider-thumb': { bgcolor: '#1f2937', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)' },
};

function Banner({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <Box
      role={tone === 'error' ? 'alert' : 'status'}
      display="flex"
      alignItems="center"
      gap={1.5}
      p={2}
      mb={3}
      bgcolor={tone === 'ok' ? '#f3f4f6' : '#fef2f2'}
      border={`1px solid ${tone === 'ok' ? 'rgba(0, 0, 0, 0.12)' : '#fecaca'}`}
      sx={{ borderRadius: '10px' }}
    >
      <Icon className={`h-5 w-5 shrink-0 ${tone === 'ok' ? 'text-[#059669]' : 'text-[#dc2626]'}`} />
      <Typography variant="body2" fontWeight={600} sx={{ color: '#1f2937' }}>
        {children}
      </Typography>
    </Box>
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function AgentSettingsPage() {
  const [defaults, setDefaults] = useState<AgentDefaults | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.4);
  const [threshold, setThreshold] = useState(0.58);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    settingsApi
      .get()
      .then((res: any) => {
        if (!mounted) return;
        const d: AgentDefaults | null = res?.data?.defaults ?? null;
        const o: AgentOverrides | null = res?.data?.overrides ?? null;
        setDefaults(d);
        setSystemPrompt(o?.system_prompt ?? d?.system_prompt ?? '');
        setModel(o?.llm_model ?? d?.llm_model ?? '');
        setTemperature(Number(o?.temperature ?? d?.temperature ?? 0.4));
        setThreshold(Number(o?.evidence_low_threshold ?? d?.evidence_low_threshold ?? 0.58));
        setUpdatedAt(o?.updated_at ?? null);
        if (!d) setNotice({ tone: 'error', text: 'Không kết nối được Core AI nên chưa hiện được giá trị mặc định.' });
      })
      .catch((err) => mounted && setNotice({ tone: 'error', text: errorMessage(err, 'Không tải được cấu hình') }))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      // Values equal to the server default are stored as NULL so later .env changes still apply.
      const res: any = await settingsApi.update({
        system_prompt: defaults && systemPrompt.trim() === defaults.system_prompt.trim() ? null : systemPrompt,
        llm_model: defaults && model.trim() === defaults.llm_model ? null : model,
        temperature: defaults && temperature === defaults.temperature ? null : temperature,
        evidence_low_threshold:
          defaults && threshold === defaults.evidence_low_threshold ? null : threshold,
      });
      setUpdatedAt(res?.data?.updated_at ?? new Date().toISOString());
      setNotice({ tone: 'ok', text: 'Đã lưu. Chatbot áp dụng cấu hình mới trong khoảng 15 giây.' });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err, 'Không lưu được cấu hình') });
    } finally {
      setSaving(false);
    }
  };

  const handleTestModel = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res: any = await settingsApi.testModel(model);
      const data = res?.data;
      setTestResult(
        data?.ok
          ? { ok: true, text: `Kết nối được [${data.provider}/${data.model}] — phản hồi sau ${data.latency_ms}ms.` }
          : { ok: false, text: `Model không phản hồi: ${data?.error || 'lỗi không rõ'}` }
      );
    } catch (err) {
      setTestResult({ ok: false, text: errorMessage(err, 'Không thử được kết nối') });
    } finally {
      setTesting(false);
    }
  };

  const saveButton = (
    <Button
      variant="contained"
      startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save className="h-4 w-4" />}
      onClick={handleSave}
      disabled={loading || saving || !model.trim()}
      sx={{
        borderRadius: '8px',
        backgroundColor: '#1f2937',
        color: '#ffffff',
        fontWeight: 600,
        textTransform: 'none',
        px: 3.5,
        py: 1,
        boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.12)',
        '&:hover': { backgroundColor: '#111827' },
      }}
    >
      Lưu cấu hình
    </Button>
  );

  return (
    <Box width="100%">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <ConfigurationPlaybook1Icon size={42} className="shrink-0 text-[#1f2937] transition-transform hover:scale-105" />
          <Box>
            <Typography variant="h5" component="h1" fontWeight={500} sx={{ color: '#1f2937', fontSize: '1.5rem', lineHeight: 1 }}>
              Cấu Hình & Tham Số Vận Hành AI Agent
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              System prompt, mô hình LLM, ngưỡng bằng chứng và temperature mà chatbot đang dùng
              {updatedAt ? ` · Cập nhật lần cuối ${new Date(updatedAt).toLocaleString('vi-VN')}` : ''}
            </Typography>
          </Box>
        </Box>
        {saveButton}
      </Box>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress size={28} sx={{ color: '#1f2937' }} />
        </Box>
      ) : (
        <Box className="emerald-card" p={{ xs: 2.5, sm: 3.5 }} bgcolor="#ffffff">
          {/* 1. System prompt */}
          <Box mb={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5} gap={2} flexWrap="wrap">
              <Typography variant="subtitle1" fontWeight={600} color="#1f2937">
                1. System Prompt
              </Typography>
              {defaults && (
                <Button
                  size="small"
                  startIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() => setSystemPrompt(defaults.system_prompt)}
                  disabled={systemPrompt.trim() === defaults.system_prompt.trim()}
                  sx={{ textTransform: 'none', color: '#1f2937' }}
                >
                  Khôi phục mặc định
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Tính cách và quy tắc trả lời. Quy tắc bảo mật và hướng dẫn trích nguồn luôn được hệ thống tự thêm vào sau phần này.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              maxRows={20}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              inputProps={{ maxLength: 8000, 'aria-label': 'System prompt' }}
              helperText={`${systemPrompt.length}/8000 ký tự`}
              sx={fieldSx}
            />
          </Box>

          <Divider sx={{ my: 3.5, borderColor: '#f3f4f6' }} />

          {/* 2. Model */}
          <Box mb={4}>
            <Typography variant="subtitle1" fontWeight={600} color="#1f2937" mb={0.5}>
              2. Mô hình LLM
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
              Nhà cung cấp và API key cấu hình trong <code>core-ai/.env</code> (LLM_PROVIDER và LLM_API_KEY hoặc key riêng của nhà cung cấp). Ở đây chỉ đổi tên model
              của nhà cung cấp đó. Hãy bấm &quot;Thử kết nối&quot; trước khi lưu.
            </Typography>

            <Box display="flex" flexDirection="column" gap={2.5}>
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Box maxWidth={450}>
                  <Typography variant="body2" fontWeight={500}>
                    Model ({defaults?.llm_provider ?? 'không rõ nhà cung cấp'}):
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mặc định trong .env: {defaults?.llm_model ?? '—'}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} flex={1} minWidth={0} maxWidth={460}>
                  <Autocomplete
                    freeSolo
                    options={defaults ? [defaults.llm_model] : []}
                    value={model}
                    onChange={(_, v) => setModel(v ?? '')}
                    onInputChange={(_, v) => setModel(v)}
                    renderInput={(params) => (
                      <TextField {...params} size="small" placeholder="Tên model" inputProps={{ ...params.inputProps, 'aria-label': 'Tên model' }} sx={fieldSx} />
                    )}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleTestModel}
                    disabled={testing || !model.trim()}
                    startIcon={testing ? <CircularProgress size={12} color="inherit" /> : undefined}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      borderColor: '#1f2937',
                      color: '#1f2937',
                      py: 0.8,
                      px: 2,
                    }}
                  >
                    Thử kết nối
                  </Button>
                </Box>
              </Box>

              {testResult && (
                <Box
                  role="status"
                  display="flex"
                  alignItems="center"
                  gap={1}
                  py={0.8}
                  px={1.5}
                  bgcolor={testResult.ok ? '#f3f4f6' : '#fef2f2'}
                  border={`1px solid ${testResult.ok ? 'rgba(0, 0, 0, 0.12)' : '#fecaca'}`}
                  sx={{ borderRadius: '8px', wordBreak: 'break-word' }}
                >
                  {testResult.ok ? (
                    <Zap className="h-4 w-4 shrink-0 text-[#059669]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#dc2626]" />
                  )}
                  <Typography variant="caption" fontWeight={500} sx={{ color: '#1f2937' }}>
                    {testResult.text}
                  </Typography>
                </Box>
              )}

              <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={2}>
                <Typography variant="body2" fontWeight={500}>
                  API key:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {defaults ? (defaults.api_key_configured ? 'Đã cấu hình trên máy chủ' : 'Chưa cấu hình API key') : '—'}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={2}>
                <Typography variant="body2" fontWeight={500}>
                  Mô hình embedding:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {defaults?.embedding_model ?? '—'} (đổi model này cần embed lại toàn bộ tài liệu, nên chỉ đổi trong .env)
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 3.5, borderColor: 'rgba(0, 0, 0, 0.08)' }} />

          {/* 3. Evidence threshold */}
          <Box mb={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={2} flexWrap="wrap">
              <Typography variant="subtitle1" fontWeight={600} color="#1f2937">
                3. Ngưỡng bằng chứng tối thiểu
              </Typography>
              <span className="rounded-full border border-[#e5e7eb] bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-[#1f2937]">
                {(threshold * 100).toFixed(0)}%
              </span>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Điểm khớp giữa câu hỏi và tài liệu dưới mức này thì chatbot không trả lời theo tài liệu, mà hỏi lại hoặc hướng dẫn liên hệ phòng ban.
              Tăng lên để chặt hơn (ít trả lời sai, nhiều câu bị từ chối hơn). Phải thấp hơn ngưỡng cao{' '}
              {defaults ? `${(defaults.evidence_high_threshold * 100).toFixed(0)}%` : ''}.
              {defaults ? ` Mặc định: ${(defaults.evidence_low_threshold * 100).toFixed(0)}%.` : ''}
            </Typography>
            <Box px={1}>
              <Slider
                value={threshold}
                min={0.3}
                max={0.75}
                step={0.01}
                onChange={(_, v) => setThreshold(v as number)}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${(v * 100).toFixed(0)}%`}
                aria-label="Ngưỡng bằng chứng tối thiểu"
                sx={sliderSx}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3.5, borderColor: 'rgba(0, 0, 0, 0.08)' }} />

          {/* 4. Temperature */}
          <Box mb={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box maxWidth={500}>
                <Typography variant="subtitle1" fontWeight={600} color="#1f2937">
                  4. Temperature: <strong>{temperature.toFixed(2)}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  0 = bám sát văn bản, câu chữ ổn định. Cao hơn = diễn đạt tự nhiên, đa dạng hơn.
                  {defaults ? ` Mặc định: ${defaults.temperature}.` : ''}
                </Typography>
              </Box>
              <Box width={{ xs: '100%', sm: 240 }} px={1}>
                <Slider
                  value={temperature}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, v) => setTemperature(v as number)}
                  valueLabelDisplay="auto"
                  aria-label="Temperature"
                  sx={sliderSx}
                />
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" pt={2.5} borderTop="1px solid rgba(0, 0, 0, 0.08)">
            {saveButton}
          </Box>
        </Box>
      )}
    </Box>
  );
}
