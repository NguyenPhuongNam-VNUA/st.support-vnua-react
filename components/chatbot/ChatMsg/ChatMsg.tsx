"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Check, ChevronDown, Copy, ExternalLink, FileText, Loader2 } from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type FileType = "pdf" | "docx" | "xlsx" | "pptx" | "other";

export interface FileTypeMeta {
  type: FileType;
  label: string;
  actionLabel: string;
  iconColor: string;
  linkColor: string;
  badgeBg: string;
  cardHoverBorder: string;
  bgLight: string;
}

export function getFileTypeMeta(
  title: string = "",
  page?: number | null,
): FileTypeMeta {
  const t = title.toLowerCase();

  if (
    t.endsWith(".docx") ||
    t.endsWith(".doc") ||
    t.includes("word") ||
    t.includes("docx") ||
    t.includes(".doc")
  ) {
    return {
      type: "docx",
      label: "DOCX",
      actionLabel: "Mở Word",
      iconColor: "text-blue-600",
      linkColor: "text-blue-600 hover:text-blue-800",
      badgeBg: "bg-blue-50 text-blue-700 border-blue-200/70",
      cardHoverBorder: "hover:border-blue-400/60",
      bgLight: "bg-blue-50/30 border-blue-100/80",
    };
  }

  if (
    t.endsWith(".xlsx") ||
    t.endsWith(".xls") ||
    t.endsWith(".csv") ||
    t.includes("excel") ||
    t.includes("bảng tính")
  ) {
    return {
      type: "xlsx",
      label: "XLSX",
      actionLabel: "Mở Excel",
      iconColor: "text-emerald-600",
      linkColor: "text-emerald-600 hover:text-emerald-800",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
      cardHoverBorder: "hover:border-emerald-400/60",
      bgLight: "bg-emerald-50/30 border-emerald-100/80",
    };
  }

  if (
    t.endsWith(".pptx") ||
    t.endsWith(".ppt") ||
    t.includes("powerpoint") ||
    t.includes("slide")
  ) {
    return {
      type: "pptx",
      label: "PPTX",
      actionLabel: "Mở Slide",
      iconColor: "text-amber-600",
      linkColor: "text-amber-600 hover:text-amber-800",
      badgeBg: "bg-amber-50 text-amber-700 border-amber-200/70",
      cardHoverBorder: "hover:border-amber-400/60",
      bgLight: "bg-amber-50/30 border-amber-100/80",
    };
  }

  // PDF is default for handbooks, regulations, files with page numbers or .pdf extension
  return {
    type: "pdf",
    label: "PDF",
    actionLabel: "Mở PDF",
    iconColor: "text-red-500",
    linkColor: "text-red-600 hover:text-red-800",
    badgeBg: "bg-red-50 text-red-700 border-red-200/70",
    cardHoverBorder: "hover:border-red-400/60",
    bgLight: "bg-red-50/30 border-red-100/80",
  };
}

export interface ChatCitation {
  citation_id: string;
  document_id: string | number;
  title: string;
  page?: number | null;
  page_end?: number | null;
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 60 60"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient
          id="cl1"
          x1="0"
          y1="0"
          x2="60"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="30" r="5" fill="url(#cl1)">
        {animate && (
          <>
            <animate
              attributeName="cy"
              values="30;22;30"
              dur="1.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </>
        )}
      </circle>
      <circle cx="30" cy="30" r="5" fill="url(#cl1)">
        {animate && (
          <>
            <animate
              attributeName="cy"
              values="30;22;30"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.15s"
            />
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.15s"
            />
          </>
        )}
      </circle>
      <circle cx="46" cy="30" r="5" fill="url(#cl1)">
        {animate && (
          <>
            <animate
              attributeName="cy"
              values="30;22;30"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.3s"
            />
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur="1.2s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </>
        )}
      </circle>
    </svg>
  );
}

const FRIENDLY_STEP_TITLES: Record<string, string> = {
  input_guardrail: "Kiểm tra nội dung an toàn",
  guardrail: "Kiểm tra nội dung an toàn",
  cache_check: "Kiểm tra bộ nhớ đệm",
  semantic_cache: "Tra cứu câu hỏi tương tự trong bộ nhớ",
  query_prep: "Phân tích yêu cầu câu hỏi",
  topic_scoring: "Xác định lĩnh vực & chủ đề câu hỏi",
  retrieval: "Tìm kiếm tài liệu & quy định đào tạo",
  evidence_eval: "Đánh giá độ xác thực của tài liệu",
  tool_node: "Tra cứu thông tin chính thức từ hệ thống",
  tool_execution: "Tra cứu thông tin chính thức từ hệ thống",
  generation: "Soạn câu trả lời cho sinh viên",
  output_guardrail: "Kiểm tra câu trả lời trước khi gửi",
  fallback: "Xử lý phương án dự phòng an toàn",
};

function formatTraceStep(item: ChatTraceStep): string {
  // If backend provided a custom friendly human message that isn't raw technical code
  if (
    item.message &&
    !item.message.includes("_") &&
    !item.message.includes("(") &&
    !item.message.includes("{")
  ) {
    if (/[\p{L}]/u.test(item.message) && !/^[a-z_]+$/.test(item.message)) {
      return item.message;
    }
  }

  // If tool was called, map to clean human description without exposing function name or args
  const rawTool =
    typeof item.details?.tool_name === "string" ? item.details.tool_name : "";
  if (rawTool) {
    if (rawTool.includes("schedule"))
      return "Tra cứu thời khóa biểu và lịch học";
    if (rawTool.includes("tuition")) return "Tra cứu biểu phí và học phí";
    if (rawTool.includes("regulation"))
      return "Tra cứu văn bản quy chế đào tạo";
    if (rawTool.includes("knowledge") || rawTool.includes("search"))
      return "Tìm kiếm dữ liệu tài liệu";
    return "Tra cứu dữ liệu chính thức từ hệ thống";
  }

  const key = (item.step || "").toLowerCase();
  return FRIENDLY_STEP_TITLES[key] || "Xử lý thông tin yêu cầu";
}

function preprocessMarkdown(content: string): string {
  if (!content) return "";

  // Tách và bảo vệ code blocks khỏi regex
  const codeBlocks: string[] = [];
  let text = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Mã nguồn nội bộ đã được hiển thị riêng trong danh sách tài liệu tham khảo.
  text = text.replace(/\[\s*src[_-]?\s*\d+(?:\s*[,;]\s*src[_-]?\s*\d+)*\s*\]/gi, "");

  // 1. Chuẩn hóa bảng Markdown (Table) khi các hàng bị gom trên cùng 1 dòng
  if (text.includes("|") && /\|[\s:-]+-[\s:-]*\|/.test(text)) {
    // Tách câu dẫn phía trước nếu dính liền hàng đầu của bảng (VD: "...cụ thể: | Tiêu chí |")
    text = text.replace(
      /([^\n|])\s*(\|[^|\n]+(?:\|[^|\n]+)+\|)(?=\s*\|[\s:-]+-)/g,
      "$1\n\n$2",
    );

    // Tách các hàng bị dính liền bởi '| |' hoặc '||' thành từng dòng mới
    text = text.replace(/\|\s*\|\s*/g, "|\n| ");

    // Tách đoạn văn bản, đường kẻ hoặc tiêu đề phía sau bảng nếu dính liền ô cuối cùng (VD: "| Ô cuối | --- ### Tiêu đề...")
    text = text.replace(
      /(^|\n)(\|[^|\n]+(?:\|[^|\n]+)+\|)[ \t]*([^|\r\n]+)$/gm,
      (match, prefix, row, trailing) => {
        const trimmedTrailing = trailing.trim();
        if (trimmedTrailing.length > 0) {
          return `${prefix}${row}\n\n${trimmedTrailing}`;
        }
        return match;
      },
    );

    // Đảm bảo trước hàng header của bảng luôn có dòng trống ngăn cách
    text = text.replace(/([^\n])\n(\|.+?\|\s*\n\|[\s:-]+-)/g, "$1\n\n$2");
  }

  // 2. Tách đường kẻ ngang và tiêu đề markdown nếu bị dính liền trên 1 dòng
  text = text.replace(/([^\n])\s+(---)\s+/g, "$1\n\n$2\n\n");
  text = text.replace(/([^\n])\s+(#{1,4}\s+)/g, "$1\n\n$2");

  // 3. Tách các mục đánh số hoặc gạch đầu dòng bị dính liền trên cùng 1 dòng
  text = text.replace(/([.!?])\s+(\d+\.\s+\*\*)/g, "$1\n\n$2");
  text = text.replace(/([.!?])\s+(\d+\.\s+[A-ZÀ-Ỹa-zà-ỹ])/g, "$1\n\n$2");
  text = text.replace(/([.!?])\s+([•\-\*]\s+\*\*)/g, "$1\n\n$2");

  // 4. Nếu có tiêu đề danh sách xuất hiện ngay sau câu dẫn mà chưa có dòng trống, thêm \n\n
  text = text.replace(/([^\n])\n(\d+\.\s+)/g, "$1\n\n$2");
  text = text.replace(/([^\n])\n([•\-\*]\s+)/g, "$1\n\n$2");

  // Khôi phục code blocks
  text = text.replace(
    /__CODE_BLOCK_(\d+)__/g,
    (_, idx) => codeBlocks[Number(idx)] || "",
  );

  return text;
}

const markdownComponents = {
  p: ({ children }: any) => (
    <p className="mb-3.5 last:mb-0 leading-[1.74] text-slate-700 text-[0.935rem]">
      {children}
    </p>
  ),
  ol: ({ children }: any) => (
    <ol className="my-3 space-y-2.5 pl-5 list-decimal text-slate-700 marker:text-blue-600 marker:font-bold marker:text-[0.95rem]">
      {children}
    </ol>
  ),
  ul: ({ children }: any) => (
    <ul className="my-3 space-y-2 pl-5 list-disc text-slate-700 marker:text-blue-500">
      {children}
    </ul>
  ),
  li: ({ children }: any) => (
    <li className="pl-1 leading-[1.68] text-slate-700 text-[0.935rem]">
      {children}
    </li>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-slate-900 bg-blue-50/80 px-1.5 py-0.5 rounded text-[0.93rem] border border-blue-100/70">
      {children}
    </strong>
  ),
  em: ({ children }: any) => (
    <em className="italic text-slate-600 font-medium">{children}</em>
  ),
  h1: ({ children }: any) => (
    <h1 className="text-[1.06rem] font-extrabold text-slate-900 mt-5 mb-2.5 pb-2 border-b border-blue-200/60 flex items-center gap-2.5 tracking-tight">
      <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block flex-shrink-0 shadow-xs" />
      <span>{children}</span>
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="ml-4 pl-3 border-l-2 border-blue-500/80 text-[0.97rem] font-bold text-slate-800 mt-4 mb-2 flex items-center gap-2 tracking-tight">
      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block flex-shrink-0" />
      <span>{children}</span>
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="ml-7 pl-2.5 border-l border-blue-300/70 text-[0.91rem] font-semibold text-slate-700 mt-3 mb-1.5 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block flex-shrink-0" />
      <span>{children}</span>
    </h3>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="my-3.5 border-l-4 border-blue-500 bg-blue-50/40 py-2.5 px-4 rounded-r-xl text-slate-700 italic text-[0.91rem] leading-relaxed shadow-xs">
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-blue-50/80 text-blue-800 font-mono text-[0.85em] font-medium border border-blue-200/60">
          {children}
        </code>
      );
    }
    return (
      <code className="block p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto my-3 leading-relaxed shadow-md border border-slate-800">
        {children}
      </code>
    );
  },
  table: ({ children }: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-xs bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-[0.84rem] text-slate-700 border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-blue-50/90 font-semibold text-blue-950 border-b border-blue-200/80">
      {children}
    </thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
  ),
  tr: ({ children }: any) => (
    <tr className="transition-colors hover:bg-blue-50/40 even:bg-slate-50/50">
      {children}
    </tr>
  ),
  th: ({ children }: any) => (
    <th className="px-3.5 py-2.5 text-left font-bold text-blue-900 tracking-normal text-[0.82rem] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-3.5 py-2.5 text-[0.84rem] leading-relaxed text-slate-700 align-top">
      {children}
    </td>
  ),
  hr: () => <hr className="my-3.5 border-slate-200/80" />,
};

export default function ChatMsg({
  message,
  timestamp,
  citations = [],
  trace = [],
  isStreaming,
  fallback,
  onConfirmRedaction,
}: ChatMsgProps) {
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalLatencyMs = trace.reduce(
    (acc, cur) => acc + (cur.latency_ms || 0),
    0,
  );
  const totalDuration =
    totalLatencyMs > 0
      ? totalLatencyMs >= 1000
        ? `${(totalLatencyMs / 1000).toFixed(1)}s`
        : `${totalLatencyMs} ms`
      : undefined;

  const currentStepTitle =
    trace.length > 0
      ? formatTraceStep(trace[trace.length - 1])
      : "Đang suy nghĩ...";
  const hasThinking = isStreaming || trace.length > 0;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        my: 2,
        maxWidth: { md: "88%", xs: "98%" },
      }}
    >
      <Box sx={{ width: 36, height: 36, flexShrink: 0 }}>
        <Image
          src="/st.png"
          alt="ST - Care"
          width={36}
          height={36}
          className="object-contain drop-shadow-sm"
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Assistant Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 0.8,
            px: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: "#2563eb", fontSize: "0.75rem" }}
          >
            ST - Care
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 500 }}
          >
            {timestamp || (isStreaming ? "Đang xử lý" : "Vừa xong")}
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
                  : `Đã suy nghĩ (${trace.length} bước${totalDuration ? ` · ${totalDuration}` : ""})`}
              </span>
              <ChevronDown
                size={13}
                className={`text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${showTrace ? "rotate-180" : ""}`}
              />
            </button>

            {/* Expanded Dropdown Panel */}
            {showTrace && trace.length > 0 && (
              <div className="mt-1.5 space-y-1.5 border-l-2 border-emerald-500/50 pl-3 py-1 text-xs text-slate-600 max-w-xl bg-emerald-50/20 rounded-r-lg">
                {trace.map((item, index) => {
                  const title = formatTraceStep(item);
                  const isDone =
                    item.status === "completed" || item.status === "passed";
                  return (
                    <div
                      key={`${item.step}-${index}`}
                      className="flex items-center justify-between gap-3 text-slate-600 py-0.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                          {isDone ? (
                            <Check size={11} strokeWidth={2.5} />
                          ) : (
                            <Loader2 size={11} className="animate-spin text-blue-600" />
                          )}
                        </span>
                        <span className="font-medium text-slate-700">
                          {title}
                        </span>
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
          <Box
            sx={{
              position: "relative",
              px: { xs: 2, sm: 2.6 },
              py: { xs: 1.8, sm: 2.2 },
              borderRadius: "4px 22px 22px 22px",
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(13, 138, 79, 0.12)",
              boxShadow:
                "0 4px 24px -4px rgba(13, 138, 79, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.02)",
              color: "#1e293b",
            }}
          >
            {message ? (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {preprocessMarkdown(message)}
                </ReactMarkdown>
              </div>
            ) : (
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                Không có nội dung phản hồi.
              </Typography>
            )}

            {message && !isStreaming && (
              <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-medium tracking-tight">
                  ST-Care Assistant
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                  title="Sao chép nội dung"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">
                        Đã chép
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {citations.length > 0 && (
              <Box
                sx={{
                  mt: 2,
                  pt: 1.6,
                  borderTop: "1px dashed rgba(13, 138, 79, 0.18)",
                }}
              >
                <details className="group/source">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[0.78rem] font-bold text-emerald-800 [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      size={14}
                      className="transition-transform group-open/source:rotate-180"
                    />
                    Nguồn văn bản tham khảo
                  </summary>
                  <div className="mt-2 grid gap-1.5">
                    {citations.slice(0, 3).map((source, index) => {
                      const meta = getFileTypeMeta(source.title, source.page);
                      return (
                        <div
                          key={source.citation_id}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 text-xs text-slate-700 shadow-2xs transition-all ${meta.bgLight}`}
                        >
                          <div className="flex items-start gap-1.5 min-w-0">
                            <FileText
                              size={14}
                              className={`${meta.iconColor} flex-shrink-0 mt-0.5`}
                            />
                            <strong className="min-w-0 leading-relaxed font-semibold text-slate-800">
                              ({index + 1}) {source.title}
                              {source.page
                                ? ` — Trang ${source.page}${source.page_end && source.page_end !== source.page ? `–${source.page_end}` : ""}`
                                : ""}
                            </strong>
                          </div>
                          <a
                            href={`/api/documents/${encodeURIComponent(String(source.document_id))}/file${source.page ? `?page=${source.page}` : ""}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-semibold ${meta.linkColor}`}
                            title={`Mở ${meta.label} trong tab mới`}
                          >
                            {meta.actionLabel}
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </Box>
            )}

            {fallback?.redacted_query && onConfirmRedaction && (
              <button
                onClick={onConfirmRedaction}
                className="mt-3 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs"
              >
                Xác nhận dùng câu hỏi đã ẩn thông tin
              </button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
