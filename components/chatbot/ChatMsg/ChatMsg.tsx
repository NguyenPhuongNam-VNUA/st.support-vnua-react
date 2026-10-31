"use client";

import React, { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, FileText, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
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
  feedback?: ChatFeedback;
  /** Omit to hide like/dislike (e.g. answers that were never saved). */
  onFeedback?: (value: ChatFeedback) => void;
}

export type ChatFeedback = "like" | "dislike" | null;

function ThinkingDots({ animate = false }: { animate?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
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
          <stop offset="0%" stopColor="#34a06b" />
          <stop offset="100%" stopColor="#0d7a46" />
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
    <p className="mb-4 last:mb-0 leading-[1.75] text-[#1f2937] text-[15px]">
      {children}
    </p>
  ),
  ol: ({ children }: any) => (
    <ol className="my-3 space-y-2 pl-6 list-decimal text-[#1f2937] marker:text-ink-subtle">
      {children}
    </ol>
  ),
  ul: ({ children }: any) => (
    <ul className="my-3 space-y-1.5 pl-6 list-disc text-[#1f2937] marker:text-ink-subtle">
      {children}
    </ul>
  ),
  li: ({ children }: any) => (
    <li className="pl-1 leading-[1.7] text-[15px]">{children}</li>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic">{children}</em>,
  h1: ({ children }: any) => (
    <h1 className="text-[18px] font-semibold text-ink mt-6 mb-3 first:mt-0 tracking-[-0.01em]">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[16.5px] font-semibold text-ink mt-6 mb-2.5 first:mt-0 tracking-[-0.01em]">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[15px] font-semibold text-ink mt-5 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="my-4 border-l-[3px] border-gray-300 pl-4 text-ink-muted text-[15px] leading-relaxed">
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-gray-100 text-ink font-mono text-[0.86em]">
          {children}
        </code>
      );
    }
    return (
      <code className="block p-4 rounded-xl bg-[#0f1411] text-gray-100 font-mono text-[13px] overflow-x-auto my-4 leading-relaxed">
        {children}
      </code>
    );
  },
  table: ({ children }: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full text-[14px] text-[#1f2937] border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-canvas border-b border-line">{children}</thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-line">{children}</tbody>
  ),
  tr: ({ children }: any) => <tr>{children}</tr>,
  th: ({ children }: any) => (
    <th className="px-4 py-2.5 text-left font-semibold text-ink text-[13px] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-2.5 leading-relaxed align-top">{children}</td>
  ),
  hr: () => <hr className="my-6 border-line" />,
};

export default function ChatMsg({
  message,
  timestamp,
  citations = [],
  trace = [],
  isStreaming,
  fallback,
  onConfirmRedaction,
  feedback = null,
  onFeedback,
}: ChatMsgProps) {
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // navigator.clipboard only exists on https/localhost; plain-http LAN access needs the legacy path.
      const area = document.createElement("textarea");
      area.value = message;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) return;
    }
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
    <div className="flex items-start gap-3 sm:gap-4 stc-rise">
      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-white border border-line flex items-center justify-center">
        <Image src="/st.png" alt="ST - Care" width={22} height={22} className="object-contain" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        {/* Thinking summary (above the answer) */}
        {hasThinking && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowTrace((prev) => !prev)}
              aria-expanded={showTrace}
              className="group inline-flex items-center gap-2 text-[13px] text-ink-subtle transition-colors hover:text-ink-muted cursor-pointer"
            >
              <ThinkingDots animate={isStreaming} />
              <span className={isStreaming ? "text-ink-muted" : ""}>
                {isStreaming
                  ? currentStepTitle
                  : `Đã xử lý ${trace.length} bước${totalDuration ? ` trong ${totalDuration}` : ""}`}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showTrace ? "rotate-180" : ""}`}
              />
            </button>

            {showTrace && trace.length > 0 && (
              <div className="mt-2 ml-[7px] space-y-1.5 border-l border-line pl-4 py-1 text-[13px] max-w-xl">
                {trace.map((item, index) => {
                  const title = formatTraceStep(item);
                  const isDone =
                    item.status === "completed" || item.status === "passed";
                  return (
                    <div
                      key={`${item.step}-${index}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0 text-ink-muted">
                        {isDone ? (
                          <Check size={13} className="text-brand flex-shrink-0" />
                        ) : (
                          <Loader2 size={13} className="animate-spin text-amber-600 flex-shrink-0" />
                        )}
                        <span>{title}</span>
                      </div>
                      {item.latency_ms != null && (
                        <span className="flex-shrink-0 text-xs text-ink-subtle tabular-nums">
                          {item.latency_ms} ms
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Answer */}
        {(message || (!isStreaming && !message)) && (
          <div>
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
              <p className="text-[15px] text-ink-subtle">
                Không có nội dung phản hồi.
              </p>
            )}

            {citations.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {citations.slice(0, 3).map((source, index) => {
                  const meta = getFileTypeMeta(source.title, source.page);
                  return (
                    <a
                      key={source.citation_id}
                      href={`/api/documents/${encodeURIComponent(String(source.document_id))}/file${source.page ? `?page=${source.page}` : ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/cite inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white pl-1.5 pr-3 py-1 text-[12.5px] text-ink-muted hover:bg-canvas hover:text-ink transition-colors"
                      title={`${meta.actionLabel}: ${source.title}`}
                    >
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-canvas text-[11px] font-medium text-ink-muted flex items-center justify-center tabular-nums">
                        {index + 1}
                      </span>
                      <FileText size={13} className={`${meta.iconColor} flex-shrink-0`} />
                      <span className="min-w-0 truncate">
                        {source.title}
                        {source.page
                          ? `, tr. ${source.page}${source.page_end && source.page_end !== source.page ? `–${source.page_end}` : ""}`
                          : ""}
                      </span>
                      <ExternalLink size={12} className="flex-shrink-0 text-ink-subtle group-hover/cite:text-ink" />
                    </a>
                  );
                })}
              </div>
            )}

            {fallback?.redacted_query && onConfirmRedaction && (
              <button
                onClick={onConfirmRedaction}
                className="mt-4 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-deep transition-colors cursor-pointer"
              >
                Gửi câu hỏi đã ẩn thông tin cá nhân
              </button>
            )}

            {message && !isStreaming && (
              <div className="mt-2 -ml-1.5 flex items-center gap-1 text-ink-subtle">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-xs transition-colors hover:bg-black/5 hover:text-ink cursor-pointer"
                  title="Sao chép câu trả lời"
                  aria-label="Sao chép câu trả lời"
                >
                  {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
                  {copied && <span className="text-brand">Đã sao chép</span>}
                </button>
                {onFeedback && (
                  <>
                    <button
                      type="button"
                      onClick={() => onFeedback(feedback === "like" ? null : "like")}
                      aria-pressed={feedback === "like"}
                      aria-label="Câu trả lời hữu ích"
                      title="Câu trả lời hữu ích"
                      className={`inline-flex items-center rounded-lg p-1.5 transition-colors hover:bg-black/5 cursor-pointer ${
                        feedback === "like" ? "text-brand" : "hover:text-ink"
                      }`}
                    >
                      <ThumbsUp size={14} className={feedback === "like" ? "fill-current" : ""} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onFeedback(feedback === "dislike" ? null : "dislike")}
                      aria-pressed={feedback === "dislike"}
                      aria-label="Câu trả lời chưa tốt"
                      title="Câu trả lời chưa tốt"
                      className={`inline-flex items-center rounded-lg p-1.5 transition-colors hover:bg-black/5 cursor-pointer ${
                        feedback === "dislike" ? "text-rose-600" : "hover:text-ink"
                      }`}
                    >
                      <ThumbsDown size={14} className={feedback === "dislike" ? "fill-current" : ""} />
                    </button>
                  </>
                )}
                {timestamp && <span className="text-[11px] ml-1">{timestamp}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
