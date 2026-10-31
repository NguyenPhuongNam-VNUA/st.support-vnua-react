'use client';

import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import Image from 'next/image';

// MUI
import TextField from '@mui/material/TextField';

// Lucide Icons
import {
  ArrowUp,
  ChevronDown,
  Menu,
  X,
  PanelRight,
  SquarePen,
  ExternalLink,
  Check,
  Loader2,
  FileText,
  Square,
} from 'lucide-react';

import UserMsg from '@/components/chatbot/UserMsg/UserMsg';
import ChatMsg, { ChatCitation, ChatFallback, ChatFeedback, ChatTraceStep, getFileTypeMeta } from '@/components/chatbot/ChatMsg/ChatMsg';
import aiApi from '@/api/chatbot/aiApi';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
  citations?: ChatCitation[];
  trace?: ChatTraceStep[];
  fallback?: ChatFallback | null;
  originalQuestion?: string;
  status?: string;
  confidence?: number;
  conversationId?: string;
  feedback?: ChatFeedback;
}

// Answers core-ai never persisted (user stopped, stream broke) cannot be rated.
const UNRATEABLE_STATUSES = new Set(['stopped', 'interrupted']);

const SUGGESTED_QUESTIONS: { label: string; query: string; tag?: string }[] = [
  {
    label: 'Thông tin tuyển sinh 2025',
    query: 'Cho tôi biết thông tin chỉ tiêu và các phương thức tuyển sinh năm 2025 của Học viện Nông nghiệp Việt Nam.',
    tag: 'Tuyển sinh',
  },
  {
    label: 'Quy chế đăng ký môn học',
    query: 'Quy trình và điều kiện đăng ký tín chỉ môn học tại VNUA như thế nào?',
    tag: 'Đào tạo',
  },
  {
    label: 'Học phí & Học bổng',
    query: 'Mức học phí theo từng ngành và các loại học bổng sinh viên có thể nhận tại VNUA?',
    tag: 'Học phí',
  },
  {
    label: 'Ký túc xá & Đời sống',
    query: 'Thủ tục đăng ký ở Ký túc xá Học viện Nông nghiệp và chi phí dịch vụ ra sao?',
    tag: 'Đời sống',
  },
  {
    label: 'Chuẩn đầu ra tốt nghiệp',
    query: 'Quy định về chuẩn đầu ra ngoại ngữ, tin học và điều kiện xét tốt nghiệp tại VNUA?',
    tag: 'Tốt nghiệp',
  },
  {
    label: 'Thời khóa biểu & Lịch thi',
    query: 'Làm thế nào để tra cứu thời khóa biểu và lịch thi học kỳ trên hệ thống đào tạo VNUA?',
    tag: 'Lịch thi',
  },
  {
    label: 'Chính sách miễn giảm học phí',
    query: 'Hồ sơ và thủ tục xin xét miễn giảm học phí hoặc trợ cấp xã hội cho sinh viên gồm những gì?',
    tag: 'Chính sách',
  },
  {
    label: 'Cấp lại thẻ SV & Bảng điểm',
    query: 'Thủ tục xin cấp lại thẻ sinh viên bị mất hoặc xin cấp giấy xác nhận, bảng điểm tại Học viện?',
    tag: 'Thủ tục',
  },
  {
    label: 'Đánh giá điểm rèn luyện',
    query: 'Quy chế đánh giá điểm rèn luyện sinh viên theo từng học kỳ và mức xếp loại quy định thế nào?',
    tag: 'Rèn luyện',
  },
  {
    label: 'Thực tập & Khóa luận tốt nghiệp',
    query: 'Điều kiện và quy trình đăng ký thực tập tốt nghiệp và làm khóa luận tốt nghiệp tại VNUA?',
    tag: 'Khóa luận',
  },
];

const FRIENDLY_STEP_TITLES: Record<string, string> = {
  input_guardrail: 'Kiểm tra nội dung an toàn',
  guardrail: 'Kiểm tra nội dung an toàn',
  cache_check: 'Kiểm tra bộ nhớ đệm',
  exact_cache: 'Tra cứu bộ nhớ đệm chính xác',
  semantic_cache: 'Tra cứu câu hỏi tương tự',
  query_prep: 'Phân tích yêu cầu câu hỏi',
  topic_scoring: 'Xác định lĩnh vực & chủ đề',
  embedding: 'Mã hóa vector ngữ nghĩa',
  retrieval: 'Tìm kiếm tài liệu & quy định đào tạo',
  evidence_eval: 'Đánh giá độ xác thực của tài liệu',
  tool_node: 'Tra cứu thông tin chính thức hệ thống',
  tool_execution: 'Tra cứu thông tin chính thức hệ thống',
  generation: 'Soạn câu trả lời cho sinh viên',
  output_guardrail: 'Kiểm tra câu trả lời trước khi gửi',
  fallback: 'Xử lý phương án dự phòng an toàn',
};

function getFriendlyStepTitle(step: ChatTraceStep): string {
  if (step.message && !step.message.includes('_') && !step.message.includes('{')) {
    return step.message;
  }
  const key = (step.step || '').toLowerCase();
  return FRIENDLY_STEP_TITLES[key] || step.step || 'Đang xử lý thông tin';
}

const STATUS_LABELS: Record<string, string> = {
  answered: 'Đã trả lời',
  stopped: 'Đã dừng',
  interrupted: 'Bị gián đoạn',
  fallback: 'Chuyển hỗ trợ',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status.toLowerCase()] || status;
}

export default function ChatBotPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [liveAnswer, setLiveAnswer] = useState('');
  const [liveTrace, setLiveTrace] = useState<ChatTraceStep[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>();
  const [liveConfidence, setLiveConfidence] = useState<number>();
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Responsive drawer states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const cleanText = (text: string) =>
    (text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .join('\n');

  const handleSend = async (customQuery?: string, piiConfirmed = false) => {
    const queryToSend = customQuery || message;
    const originalQuestion = cleanText(queryToSend);
    if (!originalQuestion || isThinking) return;
    const userMessage = originalQuestion;

    if (!customQuery) setMessage('');
    const timeNow = getCurrentTime();

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', text: userMessage, timestamp: timeNow },
    ];

    flushSync(() => {
      setMessages(newMessages);
      setIsThinking(true);
      setLiveAnswer('');
      setLiveTrace([]);
      setLiveStatus(undefined);
      setLiveConfidence(undefined);
      setSidebarOpen(false);
    });
    stopRequestedRef.current = false;

    let streamedAnswer = '';
    let streamedTrace: ChatTraceStep[] = [];
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let finalAnswer = '';
      let finalCitations: ChatCitation[] = [];
      let finalTrace: ChatTraceStep[] = [];
      let finalFallback: ChatFallback | null = null;
      let finalStatus = '';
      let finalConfidence: number | undefined;
      if (!conversationIdRef.current) {
        conversationIdRef.current = crypto.randomUUID();
        try {
          localStorage.setItem(CONV_STORAGE_KEY, conversationIdRef.current);
        } catch (e) {}
      }
      await aiApi.streamAi(
        {
          question: originalQuestion,
          conversation_id: conversationIdRef.current,
          messages: newMessages.slice(0, -1).slice(-6).map((item) => ({
            role: item.role,
            content: item.text,
          })),
          ...(piiConfirmed ? { pii_confirmed: true } : {}),
        },
        ({ event, data }) => {
          if (event === 'request.accepted') {
            // Keep trace dynamic; only record actual executed stages
          } else if (event === 'pipeline.status') {
            const traceStep = {
              step: String(data.stage),
              status: String(data.status),
              latency_ms: data.latency_ms,
              message: String(data.message || data.stage),
              details: data.details,
            };
            streamedTrace = [
              ...streamedTrace.filter((item) => item.step !== data.stage),
              traceStep,
            ];
            setLiveTrace(streamedTrace);
          } else if (event === 'answer.delta') {
            const delta = String(data.delta || '');
            streamedAnswer += delta;
            setLiveAnswer((previous) => previous + delta);
          } else if (event === 'answer.completed') {
            finalAnswer = String(data.answer || 'Không có phản hồi từ hệ thống.').trim();
            streamedAnswer = finalAnswer;
            finalCitations = Array.isArray(data.citations) ? data.citations.slice(0, 3) : [];
            finalTrace = Array.isArray(data.execution_trace) ? data.execution_trace : [];
            finalFallback = data.fallback || null;
            finalStatus = String(data.status || 'answered');
            finalConfidence = typeof data.confidence === 'number' ? data.confidence : undefined;
            setLiveAnswer(finalAnswer);
            setLiveTrace(finalTrace);
            setLiveStatus(finalStatus);
            setLiveConfidence(finalConfidence);
          } else if (event === 'answer.error') {
            throw new Error(String(data.message || 'AI Agent tạm thời không khả dụng'));
          }
        },
        controller.signal
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: finalAnswer || 'Không có phản hồi từ hệ thống.',
          timestamp: getCurrentTime(),
          citations: finalCitations,
          trace: finalTrace,
          fallback: finalFallback,
          originalQuestion,
          status: finalStatus,
          confidence: finalConfidence,
          conversationId: conversationIdRef.current,
          feedback: null,
        },
      ]);
    } catch (err) {
      if (controller.signal.aborted) {
        if (stopRequestedRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: streamedAnswer.trim()
                ? `${streamedAnswer.trim()}\n\n_Đã dừng tạo câu trả lời._`
                : 'Đã dừng tạo câu trả lời.',
              timestamp: getCurrentTime(),
              trace: streamedTrace,
              originalQuestion,
              status: 'stopped',
            },
          ]);
        }
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: streamedAnswer
            ? 'Kết nối đã bị gián đoạn trước khi câu trả lời được kiểm tra hoàn tất. Bạn vui lòng thử lại nhé!'
            : 'Xin lỗi bạn, hệ thống ST - Care hiện đang bận hoặc gặp sự cố kết nối. Bạn vui lòng thử lại sau ít phút nhé!',
          timestamp: getCurrentTime(),
          trace: streamedTrace,
          status: 'interrupted',
        },
      ]);
      console.error('Error fetching AI response:', err);
    } finally {
      abortRef.current = null;
      stopRequestedRef.current = false;
      setIsThinking(false);
      setLiveAnswer('');
      setLiveTrace([]);
      setLiveStatus(undefined);
      setLiveConfidence(undefined);
    }
  };

  const STORAGE_KEY = 'vnua_chat_messages_v1';
  const CONV_STORAGE_KEY = 'vnua_chat_conversation_id';

  const handleFeedback = async (index: number, value: ChatFeedback) => {
    const target = messages[index];
    if (!target?.conversationId) return;
    const previous = target.feedback ?? null;
    const setFeedback = (feedback: ChatFeedback) =>
      setMessages((prev) => prev.map((item, i) => (i === index ? { ...item, feedback } : item)));

    setFeedback(value);
    try {
      try {
        await aiApi.sendFeedback(target.conversationId, target.text, value);
      } catch (err: any) {
        // core-ai saves the turn right after streaming; a very fast click can beat it once.
        if (err?.status !== 404) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await aiApi.sendFeedback(target.conversationId, target.text, value);
      }
    } catch (err) {
      console.warn('Không thể lưu đánh giá câu trả lời:', err);
      setFeedback(previous);
    }
  };

  const handleStopGenerating = () => {
    if (!isThinking || !abortRef.current) return;
    stopRequestedRef.current = true;
    abortRef.current.abort();
  };

  // Load chat history from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEY);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
      const savedConvId = localStorage.getItem(CONV_STORAGE_KEY);
      if (savedConvId) {
        conversationIdRef.current = savedConvId;
      }
    } catch (e) {
      console.warn('Failed to load chat history from localStorage', e);
    }
  }, []);

  // Sync chat history to localStorage whenever messages change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Failed to save chat history to localStorage', e);
    }
  }, [messages]);

  const handleResetChat = () => {
    stopRequestedRef.current = false;
    abortRef.current?.abort();
    setMessages([]);
    setMessage('');
    conversationIdRef.current = '';
    setActiveQuestionIdx(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONV_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear chat history from localStorage', e);
    }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: isThinking ? 'instant' : 'smooth' });
    }
  }, [messages, isThinking, liveAnswer, isAtBottom]);

  // Retrieve latest assistant state for right panel
  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeTrace = isThinking ? liveTrace : (latestAssistantMessage?.trace || []);
  const activeCitations = latestAssistantMessage?.citations || [];
  const activeStatus = isThinking ? (liveStatus || 'Đang xử lý...') : (latestAssistantMessage?.status || 'Sẵn sàng');

  const canSend = !!message.trim() && !isThinking;

  const renderComposer = (variant: 'hero' | 'dock') => (
    <div
      className={`w-full bg-white border border-line rounded-[22px] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] transition-[border-color,box-shadow] focus-within:border-gray-300 focus-within:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.18)] ${
        variant === 'hero' ? 'p-3 pl-4' : 'p-2 pl-4'
      }`}
    >
      <div className={variant === 'hero' ? 'flex flex-col gap-2' : 'flex items-end gap-2'}>
        <TextField
          fullWidth
          multiline
          minRows={variant === 'hero' ? 2 : 1}
          maxRows={variant === 'hero' ? 10 : 6}
          variant="standard"
          placeholder="Hỏi về học phí, quy chế, lịch học, tuyển sinh..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          slotProps={{
            input: { disableUnderline: true },
            htmlInput: { 'aria-label': 'Nhập câu hỏi cho ST - Care' },
          }}
          sx={{
            '& textarea': {
              color: '#111827',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              pt: variant === 'hero' ? '6px' : '7px',
              pb: variant === 'dock' ? '7px' : 0,
            },
            '& textarea::placeholder': { color: '#9ca3af', opacity: 1 },
          }}
        />

        <div className={`flex items-center gap-2 ${variant === 'hero' ? 'justify-between' : 'flex-shrink-0'}`}>
          {variant === 'hero' && (
            <span className="hidden sm:inline text-xs text-ink-subtle">
              Shift + Enter để xuống dòng
            </span>
          )}
          <button
            type="button"
            onClick={isThinking ? handleStopGenerating : () => handleSend()}
            disabled={!isThinking && !message.trim()}
            aria-label={isThinking ? 'Dừng tạo câu trả lời' : 'Gửi câu hỏi'}
            title={isThinking ? 'Dừng tạo câu trả lời' : 'Gửi (Enter)'}
            className={`ml-auto h-9 w-9 flex items-center justify-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 ${
              isThinking
                ? 'bg-ink hover:bg-black text-white'
                : canSend
                  ? 'bg-brand hover:bg-brand-deep text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isThinking ? <Square size={12} fill="currentColor" /> : <ArrowUp size={18} strokeWidth={2.4} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main className="stc-app relative h-screen h-[100dvh] w-full flex overflow-hidden bg-white text-ink antialiased">
      {/* Dynamic SEO Hidden Header */}
      <header className="sr-only">
        <h1>ST - Care | Hệ Thống Trợ Lý AI Chatbot Học Viện Nông Nghiệp Việt Nam (VNUA)</h1>
        <p>ST - Care tư vấn trực tuyến 24/7 về quy chế, học phí, lịch học và tuyển sinh VNUA.</p>
      </header>

      {/* Drawer backdrops (mobile / tablet) */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/30 lg:hidden" />
      )}
      {rightPanelOpen && (
        <div onClick={() => setRightPanelOpen(false)} className="fixed inset-0 z-40 bg-black/30 xl:hidden" />
      )}

      {/* ===================================================================== */}
      {/* LEFT: navigation                                                       */}
      {/* ===================================================================== */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[272px] h-full flex flex-col flex-shrink-0
          bg-canvas border-r border-line
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-14 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Image src="/st.png" alt="ST" width={30} height={30} className="object-contain" />
            <div className="leading-tight">
              <p className="text-[14px] font-semibold text-ink">ST - Care</p>
              <p className="text-[11px] text-ink-subtle">Học viện Nông nghiệp Việt Nam</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-ink-muted hover:bg-black/5 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-1 pb-3 flex-shrink-0">
          <button
            onClick={handleResetChat}
            className="w-full h-10 flex items-center gap-2 px-3 rounded-xl bg-white border border-line text-[13.5px] font-medium text-ink hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <SquarePen size={16} className="text-ink-muted" />
            Đoạn chat mới
          </button>
        </div>

        <button
          onClick={() => setRecentsOpen((prev) => !prev)}
          className="mx-3 px-2 py-1.5 flex items-center justify-between rounded-lg text-xs font-medium text-ink-subtle hover:text-ink-muted cursor-pointer select-none"
          aria-expanded={recentsOpen}
        >
          Câu hỏi thường gặp
          <ChevronDown size={14} className={`transition-transform duration-200 ${recentsOpen ? '' : '-rotate-90'}`} />
        </button>

        {recentsOpen && (
          <nav aria-label="Câu hỏi thường gặp" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-3 flex flex-col gap-px">
            {SUGGESTED_QUESTIONS.map((q, idx) => {
              const isActive = activeQuestionIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveQuestionIdx(idx);
                    handleSend(q.query);
                    if (sidebarOpen) setSidebarOpen(false);
                  }}
                  disabled={isThinking}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[13.5px] truncate transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                    isActive ? 'bg-black/[0.06] text-ink font-medium' : 'text-ink-muted hover:bg-black/[0.04] hover:text-ink'
                  }`}
                  title={q.query}
                >
                  {q.label}
                </button>
              );
            })}
          </nav>
        )}
        {!recentsOpen && <div className="flex-1" />}

        <div className="p-3 border-t border-line flex-shrink-0">
          <a
            href="https://st-dse.vnua.edu.vn/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-black/[0.04] transition-colors"
          >
            <Image src="/fita.png" alt="" width={24} height={24} className="object-contain rounded" />
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-[12.5px] font-medium text-ink truncate">Khoa Công nghệ thông tin</p>
              <p className="text-[11px] text-ink-subtle truncate">Software Development & Research Team</p>
            </div>
            <ExternalLink size={13} className="text-ink-subtle flex-shrink-0" />
          </a>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* CENTER: conversation                                                   */}
      {/* ===================================================================== */}
      <section aria-label="Khung trò chuyện ST - Care" className="relative flex-1 min-w-0 flex flex-col h-full">
        <div className="h-14 flex items-center justify-between gap-2 px-3 sm:px-5 flex-shrink-0 border-b border-transparent">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-ink-muted hover:bg-black/5 cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>
            <span className="text-[15px] font-semibold text-ink">Trợ lý sinh viên</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Trực tuyến
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetChat}
              className="lg:hidden p-2 rounded-lg text-ink-muted hover:bg-black/5 cursor-pointer"
              aria-label="Đoạn chat mới"
            >
              <SquarePen size={18} />
            </button>
            <button
              onClick={() => setRightPanelOpen(true)}
              className="xl:hidden relative p-2 rounded-lg text-ink-muted hover:bg-black/5 cursor-pointer"
              aria-label="Xem quá trình xử lý và nguồn tham khảo"
            >
              <PanelRight size={18} />
              {activeCitations.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-white" />
              )}
            </button>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center px-4 sm:px-6 pb-10">
            <div className="w-full max-w-[720px] flex flex-col items-center my-auto">
              {/* ST animation (outside the entrance animation so mix-blend-multiply hits white) */}
              <div className="relative flex items-center justify-center min-h-[130px] sm:min-h-[160px] -mb-1" suppressHydrationWarning>
                {isMounted ? (
                  <video
                    src="/intro_logo.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    suppressHydrationWarning
                    className="w-52 sm:w-60 md:w-64 max-w-full h-auto object-contain mix-blend-multiply pointer-events-none select-none"
                  />
                ) : (
                  <div className="w-52 sm:w-60 md:w-64 h-[140px]" />
                )}
              </div>

              <div className="w-full flex flex-col items-center stc-rise">
                <h2 className="text-[26px] sm:text-[30px] font-semibold text-ink tracking-[-0.02em] text-center">
                  Bạn cần hỗ trợ điều gì?
                </h2>
                <p className="mt-2 mb-7 text-[15px] text-ink-muted text-center max-w-md leading-relaxed">
                  Giải đáp quy chế, học phí, lịch học và tuyển sinh dựa trên văn bản chính thức của Học viện.
                </p>

                {renderComposer('hero')}

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                  {SUGGESTED_QUESTIONS.slice(0, 4).map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveQuestionIdx(idx);
                        handleSend(q.query);
                      }}
                      className="text-left px-4 py-3 rounded-2xl border border-line bg-white hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <span className="block text-[13.5px] font-medium text-ink">{q.label}</span>
                      <span className="block text-[12.5px] text-ink-subtle mt-0.5 truncate">{q.query}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-8 custom-scrollbar"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 30);
              }}
            >
              <div className="max-w-[760px] mx-auto flex flex-col gap-6">
                {messages.map((msg, index) => {
                  if (msg.role === 'user')
                    return <UserMsg key={index} message={msg.text} timestamp={msg.timestamp} />;
                  if (msg.role === 'assistant')
                    return (
                      <ChatMsg
                        key={index}
                        message={msg.text}
                        timestamp={msg.timestamp}
                        citations={msg.citations}
                        trace={msg.trace}
                        fallback={msg.fallback}
                        onConfirmRedaction={
                          msg.fallback?.redacted_query
                            ? () => handleSend(msg.fallback?.redacted_query || '', true)
                            : undefined
                        }
                        feedback={msg.feedback ?? null}
                        onFeedback={
                          msg.conversationId && !UNRATEABLE_STATUSES.has(msg.status || '')
                            ? (value) => void handleFeedback(index, value)
                            : undefined
                        }
                      />
                    );
                  return null;
                })}

                {/* Live stream progress & answer */}
                {isThinking && <ChatMsg message={liveAnswer} trace={liveTrace} isStreaming />}
                <div ref={bottomRef} />
              </div>
            </div>

            {!isAtBottom && (
              <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30">
                <button
                  onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-white text-ink-muted shadow-md border border-line hover:text-ink transition-colors cursor-pointer"
                  aria-label="Cuộn xuống tin nhắn mới nhất"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            )}

            <footer className="px-3 sm:px-6 pb-3 pt-1 bg-gradient-to-t from-white via-white to-white/0">
              <div className="max-w-[760px] mx-auto">
                {renderComposer('dock')}
                <p className="text-[11px] text-ink-subtle text-center mt-2">
                  ST - Care có thể nhầm lẫn. Hãy kiểm tra lại với văn bản gốc trong phần nguồn tham khảo.
                </p>
              </div>
            </footer>
          </>
        )}
      </section>

      {/* ===================================================================== */}
      {/* RIGHT: processing steps & sources                                      */}
      {/* ===================================================================== */}
      <aside
        className={`
          fixed xl:static inset-y-0 right-0 z-50
          w-[320px] h-full flex flex-col flex-shrink-0
          bg-white border-l border-line
          overflow-y-auto custom-scrollbar
          transform transition-transform duration-300 ease-out
          ${rightPanelOpen ? 'translate-x-0 shadow-xl' : 'translate-x-full xl:translate-x-0'}
        `}
      >
        <div className="h-14 flex items-center justify-between px-5 flex-shrink-0">
          <span className="text-[14px] font-semibold text-ink">Chi tiết câu trả lời</span>
          <button
            onClick={() => setRightPanelOpen(false)}
            className="xl:hidden p-1.5 rounded-lg text-ink-muted hover:bg-black/5 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-7">
          {/* Processing steps */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-medium text-ink-subtle">Quá trình xử lý</h3>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isThinking ? 'text-amber-600' : 'text-ink-muted'}`}>
                {isThinking ? <Loader2 size={12} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {getStatusLabel(activeStatus)}
              </span>
            </div>

            {activeTrace && activeTrace.length > 0 ? (
              <ol className="flex flex-col">
                {activeTrace.map((step, sIdx) => {
                  const isLast = sIdx === activeTrace.length - 1;
                  const isStepRunning =
                    isThinking && isLast && step.status !== 'completed' && step.status !== 'passed';
                  const hasNext = !isLast || isThinking;
                  return (
                    <li key={sIdx} className="relative flex gap-3 pb-3.5 last:pb-0">
                      {hasNext && <span className="absolute left-[7.5px] top-[18px] bottom-0 w-px bg-line" />}
                      <span
                        className={`relative mt-[2px] h-4 w-4 flex-shrink-0 flex items-center justify-center rounded-full ${
                          isStepRunning ? 'text-amber-600' : 'bg-brand text-white'
                        }`}
                      >
                        {isStepRunning ? <Loader2 size={14} className="animate-spin" /> : <Check size={10} strokeWidth={3.2} />}
                      </span>
                      <span className={`text-[13px] leading-snug ${isStepRunning ? 'text-ink font-medium' : 'text-ink-muted'}`}>
                        {getFriendlyStepTitle(step)}
                      </span>
                    </li>
                  );
                })}
                {isThinking && (
                  <li className="flex gap-3 pt-0.5">
                    <span className="mt-[2px] h-4 w-4 flex-shrink-0 rounded-full border border-dashed border-gray-300" />
                    <span className="text-[13px] text-ink-subtle">Bước tiếp theo</span>
                  </li>
                )}
              </ol>
            ) : (
              <p className="text-[13px] text-ink-subtle leading-relaxed">
                {isThinking
                  ? 'Đang tìm kiếm trong kho tài liệu của Học viện...'
                  : 'Các bước ST - Care thực hiện để trả lời sẽ hiển thị tại đây.'}
              </p>
            )}
          </div>

          {/* Sources */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-medium text-ink-subtle">Nguồn tham khảo</h3>
              {activeCitations.length > 0 && (
                <span className="text-xs text-ink-subtle tabular-nums">{activeCitations.length}</span>
              )}
            </div>

            {activeCitations.length > 0 ? (
              <div className="flex flex-col gap-2">
                {activeCitations.map((source, cIdx) => {
                  const meta = getFileTypeMeta(source.title, source.page);
                  return (
                    <a
                      key={cIdx}
                      href={`/api/documents/${encodeURIComponent(String(source.document_id))}/file${source.page ? `?page=${source.page}` : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-3 rounded-xl border border-line p-3 hover:bg-canvas transition-colors"
                      title={meta.actionLabel}
                    >
                      <span className="h-8 w-8 flex-shrink-0 rounded-lg bg-canvas border border-line flex items-center justify-center">
                        <FileText size={15} className={meta.iconColor} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink leading-snug line-clamp-2">{source.title}</span>
                        <span className="block text-xs text-ink-subtle mt-1">
                          {meta.label}
                          {source.page ? `, trang ${source.page}` : ''}
                        </span>
                      </span>
                      <ExternalLink size={13} className="mt-0.5 text-ink-subtle group-hover:text-ink flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-ink-subtle leading-relaxed">
                Văn bản, quy chế được dùng để trả lời sẽ được liệt kê tại đây.
              </p>
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}
