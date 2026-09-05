'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Activity, Check, ChevronDown, Copy, ExternalLink, ShieldCheck, Wrench } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatCitation {
  citation_id: string;
  document_id: string | number;
  title: string;
  page?: number | null;
  snippet?: string;
  relevance_score?: number | null;
}

export interface ChatTraceStep {
  step: string;
  status: string;
  latency_ms?: number;
  message?: string;
  details?: Record<string, unknown> | null;
}

export interface ChatFallback {
  reason: string;
  fallback_strategy: string;
  contact_channel?: string | null;
  ticket_id?: string | null;
  redacted_query?: string | null;
}

interface ChatMsgProps {
  message: string;
  timestamp?: string;
  citations?: ChatCitation[];
  trace?: ChatTraceStep[];
  isStreaming?: boolean;
  fallback?: ChatFallback | null;
  onRequestHuman?: () => void;
  onConfirmRedaction?: () => void;
  status?: string;
  confidence?: number;
}

const STEP_LABELS: Record<string, string> = {
  accepted: 'Đã tiếp nhận câu hỏi',
  input_guardrail: 'Kiểm tra an toàn',
  cache_check: 'Tra bộ nhớ',
  semantic_cache: 'Tra bộ nhớ',
  retrieval: 'Tìm tài liệu',
  evidence_eval: 'Đánh giá nguồn',
  tool_execution: 'Gọi công cụ MCP',
  tool_node: 'Gọi công cụ MCP',
  generation: 'Soạn câu trả lời',
  fallback: 'Dùng phương án dự phòng',
  output_guardrail: 'Kiểm chứng câu trả lời',
};

export default function ChatMsg({ message, timestamp, citations = [], trace = [], isStreaming, fallback, onRequestHuman, onConfirmRedaction, status, confidence }: ChatMsgProps) {
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(Boolean(isStreaming));
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, my: 1.5, maxWidth: { md: '88%', xs: '97%' } }}>
      <Box sx={{ width: 36, height: 36, flexShrink: 0 }}>
        <Image src="/st.png" alt="ST - Care" width={36} height={36} className="object-contain drop-shadow-sm" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 0.5, px: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#006837' }}>ST - Care</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
            {timestamp || (isStreaming ? 'Đang xử lý' : 'Vừa xong')}
          </Typography>
          {status && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === 'answered' ? 'bg-emerald-100 text-emerald-800' : status === 'escalated' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
              {status === 'answered' ? 'Đã kiểm chứng' : status === 'escalated' ? 'Đã chuyển cán bộ' : status === 'clarified' ? 'Cần bổ sung' : status === 'redirected' ? 'Ngoài phạm vi' : 'Cần kiểm tra thêm'}
            </span>
          )}
          {confidence != null && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {confidence >= 0.78 ? 'Tin cậy cao' : confidence >= 0.58 ? 'Tin cậy vừa' : 'Tin cậy thấp'}
            </span>
          )}
        </Box>

        <Box sx={{ position: 'relative', px: 2.2, py: 1.6, borderRadius: '4px 20px 20px 20px', background: 'rgba(255,255,255,.94)', border: '1px solid rgba(226,232,240,.8)', boxShadow: '0 4px 20px -4px rgba(0,0,0,.06)', color: '#1e293b', fontSize: '.925rem', lineHeight: 1.65 }}>
          {message ? (
            <Box className="prose prose-sm max-w-none prose-emerald">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message}</ReactMarkdown>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748b' }}>
              <Activity size={15} className="animate-pulse" /> ST - Care bắt tay vào việc rồi đây…
            </Box>
          )}

          {!!message && (
            <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'}>
              <IconButton onClick={handleCopy} size="small" sx={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26 }}>
                {copied ? <Check size={14} color="#006837" /> : <Copy size={14} color="#64748b" />}
              </IconButton>
            </Tooltip>
          )}

          {trace.length > 0 && (
            <Box sx={{ mt: message ? 1.5 : 0 }}>
              <button onClick={() => setShowTrace((value) => !value)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700">
                <ShieldCheck size={14} /> Tiến trình xử lý
                <ChevronDown size={13} className={`transition-transform ${showTrace ? 'rotate-180' : ''}`} />
              </button>
              {showTrace && (
                <div className="mt-2 space-y-1.5 border-l-2 border-emerald-100 pl-3">
                  {trace.map((item, index) => {
                    const tool = item.details?.tool_name;
                    return (
                      <div key={`${item.step}-${index}`} className="flex items-center justify-between gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                          {tool ? <Wrench size={12} /> : <Check size={12} className="text-emerald-600" />}
                          {item.message || STEP_LABELS[item.step] || item.step}
                          {typeof tool === 'string' && <code className="rounded bg-slate-100 px-1">{tool}</code>}
                        </span>
                        {item.latency_ms != null && <span className="text-slate-400">{item.latency_ms} ms</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Box>
          )}

          {citations.length > 0 && (
            <Box sx={{ mt: 1.8, pt: 1.4, borderTop: '1px solid #e2e8f0' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>Nguồn tham khảo</Typography>
              <div className="mt-1.5 grid gap-1.5">
                {citations.slice(0, 3).map((source) => (
                  <div key={source.citation_id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1 font-semibold text-slate-700">
                      <ExternalLink size={12} /> [{source.citation_id}] {source.title}
                      {source.page ? ` · Trang ${source.page}` : ''}
                    </div>
                    {source.snippet && <p className="mt-1 line-clamp-2">{source.snippet}</p>}
                  </div>
                ))}
              </div>
            </Box>
          )}

          {fallback && (fallback.contact_channel || fallback.ticket_id) && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Hỗ trợ từ cán bộ</strong>
              {fallback.ticket_id && <span> · Mã phiếu: {fallback.ticket_id}</span>}
              {fallback.contact_channel && <p className="mt-1">{fallback.contact_channel}</p>}
              {onRequestHuman && !fallback.ticket_id && (
                <button onClick={onRequestHuman} className="mt-2 rounded-lg bg-amber-900 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-800">
                  Chuyển câu hỏi tới cán bộ
                </button>
              )}
            </div>
          )}

          {fallback?.redacted_query && onConfirmRedaction && (
            <button onClick={onConfirmRedaction} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
              Xác nhận dùng câu hỏi đã ẩn thông tin
            </button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
