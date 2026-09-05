'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

// MUI
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';

// Lucide Icons
import {
  Send,
  SquarePen,
  ChevronDown,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

import UserMsg from '@/components/chatbot/UserMsg/UserMsg';
import ChatMsg, { ChatCitation, ChatFallback, ChatTraceStep } from '@/components/chatbot/ChatMsg/ChatMsg';
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

const SUGGESTED_QUESTIONS = [
  {
    label: 'Thông tin tuyển sinh 2025',
    query: 'Cho tôi biết thông tin chỉ tiêu và các phương thức tuyển sinh năm 2025 của Học viện Nông nghiệp Việt Nam.',
  },
  {
    label: 'Quy chế đăng ký môn học',
    query: 'Quy trình và điều kiện đăng ký tín chỉ môn học tại VNUA như thế nào?',
  },
  {
    label: 'Học phí & Học bổng',
    query: 'Mức học phí theo từng ngành và các loại học bổng sinh viên có thể nhận tại VNUA?',
  },
  {
    label: 'Ký túc xá & Đời sống',
    query: 'Thủ tục đăng ký ở Ký túc xá Học viện Nông nghiệp và chi phí dịch vụ ra sao?',
  },
];

export default function ChatBotPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [liveAnswer, setLiveAnswer] = useState('');
  const [liveTrace, setLiveTrace] = useState<ChatTraceStep[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>();
  const [liveConfidence, setLiveConfidence] = useState<number>();
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);

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

    try {
      let finalAnswer = '';
      let finalCitations: ChatCitation[] = [];
      let finalTrace: ChatTraceStep[] = [];
      let finalFallback: ChatFallback | null = null;
      let finalStatus = '';
      let finalConfidence: number | undefined;
      const controller = new AbortController();
      abortRef.current = controller;
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
            setLiveTrace((previous) => [
              ...previous.filter((item) => item.step !== data.stage),
              {
                step: String(data.stage),
                status: String(data.status),
                latency_ms: data.latency_ms,
                message: String(data.message || data.stage),
                details: data.details,
              },
            ]);
          } else if (event === 'answer.delta') {
            setLiveAnswer((previous) => previous + String(data.delta || ''));
          } else if (event === 'answer.completed') {
            finalAnswer = String(data.answer || 'Không có phản hồi từ hệ thống.').trim();
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Xin lỗi bạn, hệ thống ST - Care hiện đang bận hoặc gặp sự cố kết nối. Bạn vui lòng thử lại sau ít phút nhé!',
          timestamp: getCurrentTime(),
        },
      ]);
      console.error('Error fetching AI response:', err);
    } finally {
      abortRef.current = null;
      setIsThinking(false);
      setLiveAnswer('');
      setLiveTrace([]);
      setLiveStatus(undefined);
      setLiveConfidence(undefined);
    }
  };

  const STORAGE_KEY = 'vnua_chat_messages_v1';
  const CONV_STORAGE_KEY = 'vnua_chat_conversation_id';

  // Load chat history from localStorage on mount
  useEffect(() => {
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
    abortRef.current?.abort();
    setMessages([]);
    setMessage('');
    conversationIdRef.current = '';
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
  }, [messages, isThinking, isAtBottom]);

  return (
    <main className="relative h-screen h-[100dvh] w-full flex items-center justify-center p-0 overflow-hidden font-sans">
      {/* Dynamic SEO Hidden Header */}
      <header className="sr-only">
        <h1>ST - Care | Hệ Thống Trợ Lý AI Chatbot Học Viện Nông Nghiệp Việt Nam (VNUA)</h1>
        <p>ST - Care tư vấn trực tuyến 24/7 về quy chế, học phí, lịch học và tuyển sinh VNUA.</p>
      </header>

      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/background.png"
          alt="Học viện Nông nghiệp Việt Nam"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Main Chat Window Panel - Apple Glassmorphism Aesthetic */}
      <Card
        className="apple-glass relative z-10 w-full max-w-5xl h-full flex flex-col rounded-none overflow-hidden transition-all duration-300 border-x border-white/40 border-y-0"
        elevation={0}
        sx={{ backgroundColor: 'transparent !important', boxShadow: 'none' }}
      >
        {/* Apple Glass Top Navigation Bar */}
        <div className="apple-glass-header px-4 sm:px-6 py-3.5 flex items-center justify-between z-20">
          <div className="flex items-center gap-3.5">
            {/* Logo Badge */}
            <div className="relative group cursor-pointer">
              <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105">
                <Image
                  src="/st.png"
                  alt="ST - Care Logo"
                  width={40}
                  height={40}
                  className="object-contain drop-shadow-sm"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 tracking-tight leading-tight">
                  ST - Care
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/90 text-emerald-800 border border-emerald-300/60 shadow-2xs">
                  <ShieldCheck size={11} className="text-emerald-700" /> ST AI Support
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Trợ lý thông minh Khoa công nghệ thông tin • Trực tuyến 24/7
              </p>
            </div>
          </div>

          {/* Action Header Tools */}
          <div className="flex items-center gap-1.5">
            <Tooltip title="Làm mới hội thoại" placement="bottom">
              <IconButton
                onClick={handleResetChat}
                size="small"
                className="text-slate-600 hover:bg-slate-200/60 transition-colors"
                sx={{ p: 1, borderRadius: 2 }}
              >
                <RotateCcw size={18} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Cuộc trò chuyện mới" placement="bottom">
              <IconButton
                onClick={handleResetChat}
                size="small"
                className="bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
                sx={{ p: 1, borderRadius: 2 }}
              >
                <SquarePen size={18} />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Chat Messages Body Section */}
        <section
          aria-label="Nội dung trao đổi với ST - Care"
          className="flex-1 overflow-hidden relative flex flex-col"
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 custom-scrollbar"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 30);
            }}
          >
            {messages.length === 0 ? (
              /* Hero Empty State - VNUA Apple Design Welcome */
              <div className="h-full flex flex-col items-center justify-center text-center py-6 px-4 animate-fadeIn">
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 mb-4 flex items-center justify-center drop-shadow-lg transition-transform hover:scale-105">
                  <Image
                    src="/st.png"
                    alt="ST - Care Logo"
                    width={144}
                    height={144}
                    priority
                    className="w-full h-full object-contain filter drop-shadow-md"
                  />
                </div>

                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight mb-2">
                  Xin chào! Tôi là ST - Care
                </h3>
                <p className="text-sm text-slate-600 max-w-lg mb-8 leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
                 
                  <span>
                    Trợ lý AI đồng hành cùng sinh viên{' '}
                    <strong className="text-emerald-700 font-semibold">
                      Học viện Nông nghiệp Việt Nam
                    </strong>
                    . Đặt câu hỏi bên dưới hoặc chọn chủ đề gợi ý để bắt đầu:
                  </span>
                </p>

                {/* Suggested Quick Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(q.query)}
                      className="apple-glass-card p-4 rounded-2xl sm:rounded-3xl text-left cursor-pointer group hover:border-emerald-500/40"
                    >
                      <span className="block text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition-colors mb-1">
                        {q.label}
                      </span>
                      <span className="block text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {q.query}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message List */
              <div className="flex flex-col space-y-4">
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

                {/* Immediate safe progress plus guarded answer stream */}
                {isThinking && (
                  <ChatMsg message={liveAnswer} trace={liveTrace} isStreaming />
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Floating Scroll to Bottom Button */}
          {!isAtBottom && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={() =>
                  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 text-white backdrop-blur-md text-xs font-medium shadow-lg hover:bg-slate-900 transition-all border border-white/20"
              >
                <ChevronDown size={14} /> Cuộn xuống mới nhất
              </button>
            </div>
          )}
        </section>

        {/* Input Bar Area - Apple Glass Style */}
        <footer className="px-4 sm:px-6 py-3.5 border-t border-white/35 bg-white/25 backdrop-blur-xl">
          {/* Quick Prompt Chips (Visible during active chat) */}
          {messages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1 custom-scrollbar text-xs">
              <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
                <Image src="/lightbulb.gif" alt="Gợi ý" width={16} height={16} className="object-contain inline-block" /> Gợi ý:
              </span>
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <Chip
                  key={idx}
                  label={q.label}
                  onClick={() => handleSend(q.query)}
                  size="small"
                  sx={{
                    fontSize: '11px',
                    height: '24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(236, 253, 245, 0.9)',
                      borderColor: '#006837',
                    },
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}

          {/* Input Box */}
          <div className="relative flex items-center">
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              variant="outlined"
              placeholder="Nhập câu hỏi cho ST - Care..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
                  fontSize: '0.925rem',
                  color: '#1e293b',
                  transition: 'all 0.2s ease',
                  '& textarea': {
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    '&::-webkit-scrollbar': {
                      display: 'none',
                    },
                  },
                  '& fieldset': {
                    borderColor: 'rgba(203, 213, 225, 0.8)',
                  },
                  '&:hover fieldset': {
                    borderColor: '#006837',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#006837',
                    borderWidth: '1.5px',
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Gửi câu hỏi (Enter)" placement="top">
                      <span>
                        <IconButton
                          onClick={() => handleSend()}
                          disabled={!message.trim() || isThinking}
                          sx={{
                            backgroundColor: message.trim() && !isThinking ? '#006837' : 'rgba(226, 232, 240, 0.8)',
                            color: message.trim() && !isThinking ? '#ffffff' : '#94a3b8',
                            transition: 'all 0.2s ease',
                            p: '8px',
                            '&:hover': {
                              backgroundColor: message.trim() && !isThinking ? '#00522b' : 'rgba(226, 232, 240, 0.8)',
                              transform: message.trim() && !isThinking ? 'scale(1.05)' : 'none',
                            },
                          }}
                        >
                          <Send size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
            <span>Shift + Enter để xuống dòng</span>
            <span className="font-medium">ST - Care v2.5 • VNUA</span>
          </div>
        </footer>
      </Card>
    </main>
  );
}
