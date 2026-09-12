'use client';

import { useState, useRef, useEffect } from 'react';

// MUI
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';

// Lucide Icons
import {
  Send,
  Plus,
  ChevronDown,
  ShieldCheck,
  Menu,
  X,
  SlidersHorizontal,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FileText,
  Activity,
  Square,
} from 'lucide-react';

import UserMsg from '@/components/chatbot/UserMsg/UserMsg';
import ChatMsg, { ChatCitation, ChatFallback, ChatTraceStep, getFileTypeMeta } from '@/components/chatbot/ChatMsg/ChatMsg';
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
}

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

    setMessages(newMessages);
    setIsThinking(true);
    setLiveAnswer('');
    setLiveTrace([]);
    setLiveStatus(undefined);
    setLiveConfidence(undefined);
    stopRequestedRef.current = false;

    // Auto close mobile drawer if open
    setSidebarOpen(false);

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
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, liveAnswer, isAtBottom]);

  // Retrieve latest assistant state for right panel
  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeTrace = isThinking ? liveTrace : (latestAssistantMessage?.trace || []);
  const activeCitations = latestAssistantMessage?.citations || [];
  const activeStatus = isThinking ? (liveStatus || 'Đang xử lý...') : (latestAssistantMessage?.status || 'Sẵn sàng');

  return (
    <main
      className="relative h-screen h-[100dvh] w-full flex overflow-hidden font-sans bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      {/* Dynamic SEO Hidden Header */}
      <header className="sr-only">
        <h1>ST - Care | Hệ Thống Trợ Lý AI Chatbot Học Viện Nông Nghiệp Việt Nam (VNUA)</h1>
        <p>ST - Care tư vấn trực tuyến 24/7 về quy chế, học phí, lịch học và tuyển sinh VNUA.</p>
      </header>

      {/* MOBILE BACKDROP OVERLAY FOR SIDEBAR */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (Truly transparent glass, background clearly visible)      */}
      {/* ========================================================================= */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 sm:w-72 h-full flex flex-col
          bg-white/5 backdrop-blur-xs text-slate-800 p-4 sm:p-5
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0 shadow-2xl bg-white/90' : '-translate-x-full lg:translate-x-0'}
          border-r border-white/20 shadow-none flex-shrink-0
        `}
      >
        {/* Top Section */}
        <div className="flex flex-col gap-3 flex-shrink-0 mb-3">
          {/* Mobile close button header */}
          <div className="flex items-center justify-between lg:hidden mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              ST - Care Menu
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md text-slate-700 hover:text-black hover:bg-white/40 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* "+ New" Button */}
          <button
            onClick={handleResetChat}
            className="w-full h-11 flex items-center justify-center gap-2 px-4 bg-white/30 hover:bg-orange-50/50 active:scale-98 text-slate-800 hover:text-orange-950 font-bold text-sm rounded-2xl border border-orange-200/60 hover:border-orange-400/80 shadow-xs hover:shadow-[0_0_18px_rgba(251,146,60,0.25)] transition-all cursor-pointer backdrop-blur-sm group"
            title="Tạo đoạn chat mới (+ New)"
          >
            <Plus size={17} strokeWidth={2.5} className="text-orange-600 group-hover:rotate-90 transition-transform duration-200" />
            <span>Đoạn chat mới</span>
          </button>
        </div>

        {/* "Recents" Section - Styled after IMG 1 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="mb-2 px-1 flex-shrink-0 flex items-center justify-between">
            <button
              onClick={() => setRecentsOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none group"
              title="Thu gọn / Mở rộng"
            >
              <span>Frequently Asked Questions</span>
              <ChevronDown
                size={13}
                className={`text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                  recentsOpen ? '' : '-rotate-90'
                }`}
              />
            </button>
          </div>

          {/* List of items matching IMG 1 */}
          {recentsOpen && (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 flex flex-col gap-0.5 min-h-0">
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
                    className={`w-full group relative flex items-center px-3 py-2 rounded-xl transition-all cursor-pointer select-none text-left ${
                      isActive
                        ? 'bg-orange-100/60 shadow-xs border border-orange-300/70 text-slate-950 font-medium'
                        : 'hover:bg-orange-100/40 hover:border-orange-200/60 hover:shadow-2xs text-slate-700 hover:text-slate-950'
                    }`}
                    title={q.query}
                  >
                    {/* Question text only */}
                    <span className="text-[13px] leading-snug truncate flex-1 font-medium">
                      {q.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Section: Pill / Oval button matching wireframe */}
        <div className="pt-3 mt-3 border-t border-white/20 flex flex-col items-center flex-shrink-0">
          <a
            href="https://st-dse.vnua.edu.vn/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-4 bg-white/10 hover:bg-white/25 backdrop-blur-md text-slate-800 hover:text-blue-950 text-xs font-bold rounded-full transition-all text-center flex items-center justify-center gap-1.5 border border-white/60 hover:border-white shadow-[0_0_10px_rgba(255,255,255,0.35)] active:scale-98 group cursor-pointer"
            title="Cổng thông tin Học viện Nông nghiệp Việt Nam"
          >
            <span>FITA - ST</span>
            <ExternalLink size={12} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
          </a>
          <span className="text-[10px] text-slate-500 mt-2 font-medium">
            ST - Care v2.5 • AI Support
          </span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. CENTER CANVAS (Main chat area matching wireframe)                       */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative">
        {/* Header - Transparent without full-width strip */}
        <div className="px-4 py-3 flex items-center justify-between bg-transparent z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-white/40 lg:hidden cursor-pointer"
              title="Mở thanh điều hướng"
            >
              <Menu size={22} />
            </button>
            {/* Floating glowing pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                ST - Care
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50/80 text-blue-700 border border-blue-200/60 shadow-2xs">
                <ShieldCheck size={11} className="text-blue-600" /> VNUA AI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile toggle for outputs / sources */}
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/40 text-slate-700 transition-colors cursor-pointer border border-white/50 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              title="Xem outputs & sources"
            >
              <SlidersHorizontal size={14} />
              <span>Info</span>
              {activeCitations.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </button>
          </div>
        </div>

        {/* Center Content Body */}
        <section
          aria-label="Khung trò chuyện ST - Care"
          className="flex-1 overflow-hidden relative flex flex-col"
        >
          {messages.length === 0 ? (
            /* =================================================================== */
            /* EMPTY HERO STATE - Perfectly matching center of wireframe:          */
            /* [LOGO]                                                              */
            /* [TEXT]                                                              */
            /* [Rounded Input Box with Glowing Border Effect]                      */
            /* =================================================================== */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar animate-fadeIn">
              <div className="w-full max-w-[701px] flex flex-col items-center text-center gap-5 my-auto">
                {/* 1. Video Animation intro_logo.mp4 tràn viền đặt trực tiếp lên background */}
                <div
                  className="relative flex items-center justify-center -my-3 min-h-[140px] sm:min-h-[160px]"
                  suppressHydrationWarning
                >
                  {isMounted ? (
                    <video
                      src="/intro_logo.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      suppressHydrationWarning
                      className="w-56 sm:w-64 md:w-72 max-w-full h-auto object-contain mix-blend-multiply pointer-events-none select-none"
                    />
                  ) : (
                    <div className="w-56 sm:w-64 md:w-72 h-[150px]" />
                  )}
                </div>

                {/* 2. TEXT Box with Glowing Border */}
                <div className="bg-white/15 backdrop-blur-xs text-slate-900 font-extrabold text-sm sm:text-base px-8 py-2.5 rounded-xl tracking-wider uppercase shadow-[0_0_15px_rgba(255,255,255,0.6)] border border-white/70">
                  ST - CARE | TRỢ LÝ AI VNUA
                </div>

                <p className="text-xs text-slate-600 font-medium max-w-md -mt-1 leading-relaxed">
                  Hệ thống hỗ trợ sinh viên Học viện Nông nghiệp Việt Nam về quy chế, học phí, lịch học và tuyển sinh.
                </p>

                {/* 3. Liquid-Glass Input Box Wrapper - Height reduced by 15px to 173px, dynamically expands on multiline */}
                <div className="relative w-[701px] max-md:w-[calc(100vw-48px)] min-h-[173px] bg-white/[0.06] border-[3px] border-white rounded-[44px] shadow-[0_0_4px_0_rgba(0,0,0,0.15)] overflow-hidden backdrop-blur-[20px] flex flex-col justify-between p-4 sm:p-5 sm:px-6 text-left transition-all">
                  <div className="flex-1 flex flex-col">
                    <TextField
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={12}
                      variant="standard"
                      placeholder="Nhập câu hỏi cho ST - Care..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      InputProps={{
                        disableUnderline: true,
                      }}
                      sx={{
                        '& textarea': {
                          color: '#0f172a',
                          fontSize: '0.98rem',
                          lineHeight: '1.6',
                        },
                        '& textarea::placeholder': {
                          color: '#64748b',
                          opacity: 0.85,
                        },
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/20">
                    <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      Nhấn Enter để gửi • Shift + Enter xuống dòng
                    </span>
                    <Tooltip title="Gửi câu hỏi" placement="top">
                      <span>
                        <IconButton
                          onClick={() => handleSend()}
                          disabled={!message.trim() || isThinking}
                          sx={{
                            backgroundColor: message.trim() && !isThinking ? '#2563eb' : 'rgba(255, 255, 255, 0.4)',
                            color: message.trim() && !isThinking ? '#ffffff' : '#64748b',
                            transition: 'all 0.2s ease',
                            p: '8px',
                            '&:hover': {
                              backgroundColor: message.trim() && !isThinking ? '#1d4ed8' : 'rgba(255, 255, 255, 0.4)',
                              transform: message.trim() && !isThinking ? 'scale(1.05)' : 'none',
                              boxShadow: '0 0 15px rgba(37, 99, 235, 0.45)',
                            },
                          }}
                        >
                          <Send size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* =================================================================== */
            /* ACTIVE CHAT STATE - Messages List                                   */
            /* =================================================================== */
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 custom-scrollbar bg-transparent"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 30);
              }}
            >
              <div className="max-w-3xl mx-auto flex flex-col space-y-4">
                {messages.map((msg, index) => {
                  if (msg.role === 'user')
                    return (
                      <UserMsg
                        key={index}
                        message={msg.text}
                        timestamp={msg.timestamp}
                      />
                    );
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
                      />
                    );
                  return null;
                })}

                {/* Live stream progress & answer */}
                {isThinking && (
                  <ChatMsg message={liveAnswer} trace={liveTrace} isStreaming />
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          )}

          {/* Floating Scroll to Bottom Button */}
          {messages.length > 0 && !isAtBottom && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={() =>
                  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-xs text-xs font-medium shadow-md transition-all border border-white/20 cursor-pointer"
              >
                <ChevronDown size={14} /> Cuộn xuống mới nhất
              </button>
            </div>
          )}

          {/* Active Chat Bottom Input Dock - Transparent with glowing border input */}
          {messages.length > 0 && (
            <footer className="p-3 sm:p-4 bg-transparent border-t border-white/20">
              <div className="max-w-3xl mx-auto">
                {/* Input box with light orange border effect for high visibility */}
                <div className="w-full bg-white/20 hover:bg-white/30 focus-within:bg-white/40 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border-2 border-orange-300/80 shadow-[0_2px_15px_rgba(251,146,60,0.15),0_0_15px_rgba(255,255,255,0.6)] transition-all hover:border-orange-400 hover:shadow-[0_0_22px_rgba(251,146,60,0.25)] focus-within:border-orange-500 focus-within:shadow-[0_0_28px_rgba(249,115,22,0.32)]">
                  <TextField
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={4}
                    variant="standard"
                    placeholder="Nhập câu hỏi cho ST - Care..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    InputProps={{
                      disableUnderline: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title={isThinking ? 'Dừng tạo' : 'Gửi câu hỏi (Enter)'} placement="top">
                            <span>
                              <IconButton
                                onClick={isThinking ? handleStopGenerating : () => handleSend()}
                                disabled={!isThinking && !message.trim()}
                                aria-label={isThinking ? 'Dừng tạo câu trả lời' : 'Gửi câu hỏi'}
                                sx={{
                                  backgroundColor: isThinking ? '#dc2626' : message.trim() ? '#ea580c' : 'rgba(255, 255, 255, 0.4)',
                                  color: isThinking || message.trim() ? '#ffffff' : '#64748b',
                                  transition: 'all 0.2s ease',
                                  p: '6px',
                                  '&:hover': {
                                    backgroundColor: isThinking ? '#b91c1c' : message.trim() ? '#c2410c' : 'rgba(255, 255, 255, 0.4)',
                                    transform: isThinking || message.trim() ? 'scale(1.05)' : 'none',
                                    boxShadow: isThinking ? 'none' : '0 0 15px rgba(234, 88, 12, 0.45)',
                                  },
                                }}
                              >
                                {isThinking ? <Square size={14} fill="currentColor" /> : <Send size={16} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& textarea': {
                        color: '#0f172a',
                        fontSize: '0.925rem',
                      },
                    }}
                  />
                </div>
              </div>
            </footer>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT PANEL (outputs & sources, transparent with glowing border card)  */}
      {/* ========================================================================= */}
      {rightPanelOpen && (
        <div
          onClick={() => setRightPanelOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 right-0 z-50
          w-72 xl:w-80 h-full p-4 sm:p-5 flex flex-col justify-start
          bg-transparent border-l border-white/20 shadow-none overflow-y-auto custom-scrollbar
          transform transition-transform duration-300 ease-in-out
          ${rightPanelOpen ? 'translate-x-0 shadow-2xl bg-white/90' : 'translate-x-full lg:translate-x-0'}
          flex-shrink-0
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between lg:hidden mb-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Thông tin chi tiết
          </span>
          <button
            onClick={() => setRightPanelOpen(false)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white/60 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Card Frame with glowing border effect */}
        <div className="w-full bg-white/10 hover:bg-orange-500/[0.04] backdrop-blur-xs rounded-2xl p-4 sm:p-5 border border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_25px_rgba(251,146,60,0.25)] hover:border-orange-300/60 flex flex-col gap-3 transition-all">
          {/* SECTION: outputs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 tracking-wider">
                outputs
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-900 bg-orange-100/80 px-2 py-0.5 rounded-full shadow-2xs border border-orange-200/70">
                {isThinking ? (
                  <Loader2 size={10} className="text-orange-600 animate-spin flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />
                )}
                {activeStatus}
              </span>
            </div>

            {/* Outputs Trace Steps without latency */}
            <div className="min-h-[60px] max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 text-xs bg-white/10 hover:bg-orange-50/20 border border-white/30 hover:border-orange-200/50 rounded-xl p-2 transition-all">
              {activeTrace && activeTrace.length > 0 ? (
                <>
                  {activeTrace.map((step, sIdx) => {
                    const isLast = sIdx === activeTrace.length - 1;
                    const isStepRunning =
                      isThinking &&
                      isLast &&
                      step.status !== 'completed' &&
                      step.status !== 'passed';
                    return (
                      <div
                        key={sIdx}
                        className="flex items-center justify-between gap-1.5 bg-white/30 rounded-md p-1.5 text-[11px] text-slate-800 shadow-2xs border border-white/40"
                      >
                        <span className="truncate flex items-center gap-1.5 font-medium">
                          {isStepRunning ? (
                            <Loader2 size={12} className="text-blue-600 animate-spin flex-shrink-0" />
                          ) : (
                            <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                          )}
                          {getFriendlyStepTitle(step)}
                        </span>
                      </div>
                    );
                  })}
                  {isThinking && (
                    <div className="flex items-center gap-1.5 bg-white/20 rounded-md p-1.5 text-[11px] text-slate-600 italic shadow-2xs border border-white/30">
                      <Loader2 size={12} className="text-blue-600 animate-spin flex-shrink-0" />
                      <span className="truncate font-medium">Đang xử lý bước tiếp theo...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-slate-600 italic py-1 leading-relaxed flex items-center gap-1.5">
                  {isThinking ? (
                    <>
                      <Loader2 size={12} className="text-blue-600 animate-spin flex-shrink-0" />
                      <span>Đang tiến hành truy vấn RAG...</span>
                    </>
                  ) : (
                    'Hệ thống AI sẵn sàng tiếp nhận câu hỏi.'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DIVIDER LINE matching wireframe */}
          <div className="border-t border-white/30 my-0.5" />

          {/* SECTION: sources */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 tracking-wider">
                sources
              </h3>
              {activeCitations.length > 0 && (
                <span className="text-[10px] font-bold text-blue-800 bg-blue-100/70 px-1.5 py-0.5 rounded border border-blue-200/60 shadow-2xs">
                  {activeCitations.length} trích dẫn
                </span>
              )}
            </div>

            {/* Sources List */}
            <div className="min-h-[80px] max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-2 text-xs bg-white/10 hover:bg-orange-50/20 border border-white/30 hover:border-orange-200/50 rounded-xl p-2 transition-all">
              {activeCitations && activeCitations.length > 0 ? (
                activeCitations.map((source, cIdx) => {
                  const meta = getFileTypeMeta(source.title, source.page);
                  return (
                    <div
                      key={cIdx}
                      className={`bg-white/30 hover:bg-orange-50/40 rounded-lg p-2.5 text-[11px] text-slate-800 flex flex-col gap-1 border border-white/40 hover:border-orange-200/60 ${meta.cardHoverBorder} shadow-2xs transition-all`}
                    >
                      <div className="font-semibold text-slate-900 line-clamp-2 leading-tight flex items-start gap-1.5">
                        <FileText size={14} className={`${meta.iconColor} flex-shrink-0 mt-0.5`} />
                        <span className="flex-1">{source.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${meta.badgeBg}`}>
                          {meta.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-600">
                        <span>
                          {source.page ? `Trang ${source.page}` : 'Tài liệu chuẩn'}
                        </span>
                        <a
                          href={`/api/documents/${encodeURIComponent(String(source.document_id))}/file${source.page ? `?page=${source.page}` : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 font-bold ${meta.linkColor} cursor-pointer`}
                          title={`Mở tài liệu ${meta.label}`}
                        >
                          {meta.actionLabel}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-[11px] text-slate-600 italic py-1 leading-relaxed">
                  Chưa có nguồn tài liệu tham khảo nào được trích dẫn.
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
