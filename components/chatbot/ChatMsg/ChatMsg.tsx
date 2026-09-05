'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Check, ChevronDown, Copy, ExternalLink } from 'lucide-react';
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
  onConfirmRedaction?: () => void;
}

function ClaudeThinkingIcon({ animate = false }: { animate?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 60 60" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="cl1" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="30" r="5" fill="url(#cl1)">
        {animate && (
          <>
            <animate attributeName="cy" values="30;22;30" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
          </>
        )}
      </circle>
      <circle cx="30" cy="30" r="5" fill="url(#cl1)">
        {animate && (
          <>
            <animate attributeName="cy" values="30;22;30" dur="1.2s" repeatCount="indefinite" begin="0.15s" />
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" begin="0.15s" />
          </>
        )}
      </circle>
      <circle cx="46" cy="30" r="5" fill="url(#cl1)">
        {animate && (
          <>
            <animate attributeName="cy" values="30;22;30" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
          </>
        )}
      </circle>
    </svg>
  );
}

const FRIENDLY_STEP_TITLES: Record<string, string> = {
  input_guardrail: 'Kiểm tra nội dung an toàn',
  guardrail: 'Kiểm tra nội dung an toàn',
  cache_check: 'Kiểm tra bộ nhớ đệm',
  semantic_cache: 'Tra cứu câu hỏi tương tự trong bộ nhớ',
  query_prep: 'Phân tích yêu cầu câu hỏi',
  topic_scoring: 'Xác định lĩnh vực & chủ đề câu hỏi',
  retrieval: 'Tìm kiếm tài liệu & quy định đào tạo',
  evidence_eval: 'Đánh giá độ xác thực của tài liệu',
  tool_node: 'Tra cứu thông tin chính thức từ hệ thống',
  tool_execution: 'Tra cứu thông tin chính thức từ hệ thống',
  generation: 'Soạn câu trả lời cho sinh viên',
  output_guardrail: 'Kiểm tra câu trả lời trước khi gửi',
  fallback: 'Xử lý phương án dự phòng an toàn',
};

function formatTraceStep(item: ChatTraceStep): string {
  // If backend provided a custom friendly human message that isn't raw technical code
  if (item.message && !item.message.includes('_') && !item.message.includes('(') && !item.message.includes('{')) {
    if (/[\p{L}]/u.test(item.message) && !/^[a-z_]+$/.test(item.message)) {
      return item.message;
    }
  }

  // If tool was called, map to clean human description without exposing function name or args
  const rawTool = typeof item.details?.tool_name === 'string' ? item.details.tool_name : '';
  if (rawTool) {
    if (rawTool.includes('schedule')) return 'Tra cứu thời khóa biểu và lịch học';
    if (rawTool.includes('tuition')) return 'Tra cứu biểu phí và học phí';
    if (rawTool.includes('regulation')) return 'Tra cứu văn bản quy chế đào tạo';
    if (rawTool.includes('knowledge') || rawTool.includes('search')) return 'Tìm kiếm dữ liệu tài liệu';
    return 'Tra cứu dữ liệu chính thức từ hệ thống';
  }

  const key = (item.step || '').toLowerCase();
  return FRIENDLY_STEP_TITLES[key] || 'Xử lý thông tin yêu cầu';
}

export default function ChatMsg({ message, timestamp, citations = [], trace = [], isStreaming, fallback, onConfirmRedaction }: ChatMsgProps) {
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalLatencyMs = trace.reduce((acc, cur) => acc + (cur.latency_ms || 0), 0);
  const totalDuration = totalLatencyMs > 0
    ? totalLatencyMs >= 1000
      ? `${(totalLatencyMs / 1000).toFixed(1)}s`
      : `${totalLatencyMs} ms`
    : undefined;

  const currentStepTitle = trace.length > 0 ? formatTraceStep(trace[trace.length - 1]) : 'Đang suy nghĩ...';
  const hasThinking = isStreaming || trace.length > 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, my: 1.5, maxWidth: { md: '88%', xs: '97%' } }}>
      <Box sx={{ width: 36, height: 36, flexShrink: 0 }}>
        <Image src="/st.png" alt="ST - Care" width={36} height={36} className="object-contain drop-shadow-sm" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Assistant Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, px: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#006837', fontSize: '0.75rem' }}>ST - Care</Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
            {timestamp || (isStreaming ? 'Đang xử lý' : 'Vừa xong')}
          </Typography>
        </Box>

        {/* Claude-style Thinking Section (ABOVE the answer) */}
        {hasThinking && (
          <Box sx={{ mb: 1.2 }}>
            <button
              type="button"
              onClick={() => setShowTrace((prev) => !prev)}
              className="group inline-flex items-center gap-2 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 cursor-pointer"
            >
              <ClaudeThinkingIcon animate={isStreaming} />
              <span>
                {isStreaming
                  ? currentStepTitle
                  : `Đã suy nghĩ (${trace.length} bước${totalDuration ? ` · ${totalDuration}` : ''})`}
              </span>
              <ChevronDown
                size={13}
                className={`text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${showTrace ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Expanded Dropdown Panel */}
            {showTrace && trace.length > 0 && (
              <div className="mt-1.5 space-y-1.5 border-l-2 border-slate-200/80 pl-3 py-1 text-xs text-slate-600 max-w-xl">
                {trace.map((item, index) => {
                  const title = formatTraceStep(item);
                  const isDone = item.status === 'completed' || item.status === 'passed';
                  return (
                    <div
                      key={`${item.step}-${index}`}
                      className="flex items-center justify-between gap-3 text-slate-600 py-0.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          {isDone ? (
                            <Check size={11} strokeWidth={2.5} />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </span>
                        <span className="font-medium text-slate-700">{title}</span>
                      </div>
                      {item.latency_ms != null && (
                        <span className="flex-shrink-0 text-[11px] text-slate-400 font-mono">
                          {item.latency_ms} ms
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Box>
        )}

        {/* Message Bubble */}
        {(message || (!isStreaming && !message)) && (
          <Box sx={{ position: 'relative', px: 2.2, py: 1.6, borderRadius: '4px 20px 20px 20px', background: 'rgba(255,255,255,.94)', border: '1px solid rgba(226,232,240,.8)', boxShadow: '0 4px 20px -4px rgba(0,0,0,.06)', color: '#1e293b', fontSize: '.925rem', lineHeight: 1.65 }}>
            {message ? (
              <Box className="prose prose-sm max-w-none prose-emerald">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message}</ReactMarkdown>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#64748b' }}>Không có nội dung phản hồi.</Typography>
            )}

            {message && !isStreaming && (
              <div className="mt-2.5 flex items-center justify-end pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  title="Sao chép nội dung"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Đã chép' : 'Chép'}</span>
                </button>
              </div>
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

            {fallback?.redacted_query && onConfirmRedaction && (
              <button onClick={onConfirmRedaction} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                Xác nhận dùng câu hỏi đã ẩn thông tin
              </button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
