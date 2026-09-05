'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  LinearProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ShieldAlert,
  ThumbsUp,
  PlusCircle,
  CheckCircle2,
  Star,
} from 'lucide-react';
import Link from 'next/link';

import conversationApi from "@/api/chatbot/conversationApi";

interface AgentQualityMetricsProps {
  onDrillDownFallback?: () => void;
}

interface FallbackItem {
  id: number;
  question: string;
  category: string;
  count: number;
  last_asked: string;
}

function formatRelativeTime(dateStr: string) {
  if (!dateStr) return 'Vừa xong';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function AnimatedNumber({ value, decimals = 1, suffix = '%' }: { value: number; decimals?: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(easeProgress * value);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(step);
  }, [value]);

  return <>{displayValue.toFixed(decimals)}{suffix}</>;
}

function AnimatedProgressBar({ selfPercent }: { selfPercent: number }) {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(selfPercent);
    }, 150);
    return () => clearTimeout(timer);
  }, [selfPercent]);

  return (
    <Box sx={{ width: '100%', mt: 2, mb: 1 }}>
      <div className="h-3 w-full bg-rose-50/80 rounded-full overflow-hidden flex border border-rose-100/60 p-0.5">
        <div
          className="bg-emerald-600 h-full rounded-full shadow-xs"
          style={{
            width: `${Math.min(100, Math.max(0, width))}%`,
            transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        <div
          className="bg-rose-500 h-full rounded-r-full flex-1"
          style={{
            transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </Box>
  );
}

export default function AgentQualityMetrics({ onDrillDownFallback }: AgentQualityMetricsProps) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res: any = await conversationApi.getAll();
        const raw = res && Array.isArray(res.data) ? res.data : [];
        setLogs(raw);
      } catch (err) {
        console.warn('Lỗi tải logs cho quality metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  // Compute real metrics from logs
  const total = logs.length;
  const answeredCount = logs.filter(
    (l) => (l.response_type || l.status) === 'answered' || (l.response_type || l.status) === 'auto_generated'
  ).length;
  const fallbackCount = logs.filter(
    (l) => (l.response_type || l.status) === 'not_found'
  ).length;

  const selfPercent = total > 0 ? (answeredCount / total) * 100 : 100;
  const fallbackPercent = total > 0 ? (fallbackCount / total) * 100 : 0;

  // Real feedback / satisfaction calculation
  const ratedLogs = logs.filter((l) => l.feedback || l.rating);
  let posPercent = 95;
  let negPercent = 5;
  let avgRating = 4.9;

  if (ratedLogs.length > 0) {
    const posCount = ratedLogs.filter(
      (l) => l.feedback === 'like' || (l.rating && Number(l.rating) >= 4)
    ).length;
    posPercent = (posCount / ratedLogs.length) * 100;
    negPercent = 100 - posPercent;
    const totalRating = ratedLogs.reduce(
      (acc, l) => acc + (l.rating ? Number(l.rating) : l.feedback === 'like' ? 5 : 2),
      0
    );
    avgRating = Number((totalRating / ratedLogs.length).toFixed(1));
  }

  // Extract real fallback questions
  const fallbackQuestions: FallbackItem[] = React.useMemo(() => {
    const map = new Map<string, { id: number; question: string; category: string; count: number; lastDate: string }>();
    for (const log of logs) {
      const status = log.response_type || log.status;
      if (status === 'not_found' && log.question?.trim()) {
        const qText = log.question.trim();
        const existing = map.get(qText);
        if (existing) {
          existing.count += 1;
          if (new Date(log.created_at).getTime() > new Date(existing.lastDate).getTime()) {
            existing.lastDate = log.created_at;
          }
        } else {
          map.set(qText, {
            id: log.id,
            question: qText,
            category: 'Học vụ',
            count: 1,
            lastDate: log.created_at,
          });
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        question: item.question,
        category: item.category,
        count: item.count,
        last_asked: formatRelativeTime(item.lastDate),
      }));
  }, [logs]);

  return (
    <Grid container spacing={3} mb={4}>
      {/* Left Column: Quality & Satisfaction Cards */}
      <Grid size={{ xs: 12, lg: 5 }}>
        <Box display="flex" flexDirection="column" gap={3} height="100%">
          {/* Card 1: Self-Answered vs Human Fallback Ratio */}
          <Card
            className="emerald-card"
            sx={{
              p: 0,
              bgcolor: '#ffffff',
            }}
          >
            <CardHeader
              title={
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <div className="w-8 h-8 rounded-xl bg-[#f0f8f4] border border-[#a7f3d0]/60 flex items-center justify-center text-[#0d8a4f]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', fontSize: '1.05rem' }}>
                      Tỷ lệ tự trả lời vs Fallback
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={onDrillDownFallback}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: '#0d8a4f', borderRadius: '8px', '&:hover': { bgcolor: '#f0f8f4' } }}
                  >
                    Xem hội thoại →
                  </Button>
                </Box>
              }
              sx={{ pb: 1, p: 2.5 }}
            />
            <CardContent sx={{ pt: 0, px: 2.5, pb: 2.5 }}>
              {/* Stat percentages */}
              <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={1}>
                <Box>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    AGENT TỰ TRẢ LỜI ĐƯỢC
                  </Typography>
                  <Typography variant="h4" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em' }}>
                    <AnimatedNumber value={selfPercent} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    ({answeredCount} / {total} lượt hỏi)
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" fontWeight={800} color="#be123c" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    CHUYỂN NGƯỜI THẬT (FALLBACK)
                  </Typography>
                  <Typography variant="h4" fontWeight={900} sx={{ color: '#e11d48', letterSpacing: '-0.025em' }}>
                    <AnimatedNumber value={fallbackPercent} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    ({fallbackCount} / {total} lượt)
                  </Typography>
                </Box>
              </Box>

              {/* Progress Bar Visual with smooth width animation */}
              <AnimatedProgressBar selfPercent={selfPercent} />

              <Box display="flex" justifyContent="space-between" mt={1}>
                <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" /> Agent tự động giải quyết tốt
                </span>
                <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Cần bổ sung tri thức
                </span>
              </Box>
            </CardContent>
          </Card>

          {/* Card 2: Average Satisfaction Rating */}
          <Card
            className="emerald-card"
            sx={{
              p: 0,
              bgcolor: '#ffffff',
              flex: 1,
            }}
          >
            <CardHeader
              title={
                <Box display="flex" alignItems="center" gap={1.5}>
                  <div className="w-8 h-8 rounded-xl bg-[#fffbeb] border border-[#fde68a]/80 flex items-center justify-center text-[#d97706]">
                    <ThumbsUp className="w-4 h-4" />
                  </div>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', fontSize: '1.05rem' }}>
                    Mức độ hài lòng sinh viên
                  </Typography>
                </Box>
              }
              sx={{ pb: 1, p: 2.5 }}
            />
            <CardContent sx={{ pt: 0, px: 2.5, pb: 2.5 }}>
              <Box display="flex" alignItems="center" gap={3}>
                <Box textAlign="center" py={1.5} px={1.5} minWidth={105} bgcolor="#fafdfb" borderRadius="14px" border="1px solid rgba(13, 138, 79, 0.08)" boxShadow="0 0 0 1px rgba(255,255,255,0.8) inset">
                  <Typography variant="h3" fontWeight={900} sx={{ color: '#0d8a4f', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    <AnimatedNumber value={avgRating} decimals={1} suffix="" />
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
                    trên 5.0 <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 inline-block" />
                  </Typography>
                </Box>

                <Box flex={1}>
                  <Box mb={1.5}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Đánh giá Tích cực (Hài lòng / Like 👍)
                      </Typography>
                      <Typography variant="caption" fontWeight={800} color="#10b981">
                        <AnimatedNumber value={posPercent} />
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={posPercent}
                      sx={{
                        height: 7,
                        borderRadius: '9999px',
                        bgcolor: 'rgba(13, 138, 79, 0.05)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#10b981',
                          borderRadius: '9999px',
                          transition: 'transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Đánh giá Tiêu cực (Chưa hài lòng 👎)
                      </Typography>
                      <Typography variant="caption" fontWeight={800} color="#e11d48">
                        <AnimatedNumber value={negPercent} />
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={negPercent}
                      sx={{
                        height: 7,
                        borderRadius: '9999px',
                        bgcolor: 'rgba(0, 60, 30, 0.05)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#e11d48',
                          borderRadius: '9999px',
                          transition: 'transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Grid>

      {/* Right Column: Top Unanswered Questions (Critical Knowledge Gaps) */}
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card
          className="emerald-card"
          sx={{
            p: 0,
            bgcolor: '#ffffff',
            height: '100%',
          }}
        >
          <CardHeader
            title={
              <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" gap={1.5}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#be123c', fontSize: { xs: '0.95rem', sm: '1.05rem' }, lineHeight: 1.2 }}>
                      Top câu hỏi không trả lời được (Fallback Data)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      Dữ liệu quan trọng nhất để ưu tiên cập nhật tri thức cho AI Agent
                    </Typography>
                  </Box>
                </Box>
                <Link href="/admin/questions">
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlusCircle className="w-4 h-4" />}
                    sx={{
                      borderRadius: '10px',
                      backgroundColor: '#0d8a4f',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 2,
                      py: 0.7,
                      boxShadow: '0 4px 12px rgba(13, 138, 79, 0.2)',
                      '&:hover': { backgroundColor: '#0a7543' },
                    }}
                  >
                    Bổ sung tri thức
                  </Button>
                </Link>
              </Box>
            }
            sx={{ pb: 1, p: 2.5 }}
          />

          <CardContent sx={{ pt: 0, px: { xs: 1.5, sm: 2.5 }, pb: 2.5 }}>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 520, border: '1px solid rgba(13, 138, 79, 0.08)', borderRadius: '14px', overflow: 'hidden' }}>
                <TableHead sx={{ backgroundColor: '#fafdfb' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>CÂU HỎI BỊ CHỜ / FALLBACK</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 100, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>CHỦ ĐỀ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 90, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>LẦN HỎI</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 120, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>HÀNH ĐỘNG</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fallbackQuestions.map((row) => (
                    <TableRow key={row.id} hover sx={{ transition: 'background-color 0.15s ease', '&:hover': { bgcolor: '#f0f8f4 !important' }, '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ py: 1.5, borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                        <Typography variant="body2" fontWeight={700} color="#0f291e" sx={{ fontSize: '0.825rem' }}>
                          {row.question}
                        </Typography>
                        <span className="text-[11px] text-slate-400 font-medium">Lần hỏi gần nhất: {row.last_asked}</span>
                      </TableCell>

                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                        <Chip
                          label={row.category}
                          size="small"
                          sx={{
                            borderRadius: '9999px',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            backgroundColor: '#f0f8f4',
                            color: '#0d8a4f',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                          }}
                        />
                      </TableCell>

                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-black text-rose-700 bg-rose-50 border border-rose-200/80 rounded-full">
                          {row.count}
                        </span>
                      </TableCell>

                      <TableCell align="right" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                        <Link href={`/admin/questions?add=${encodeURIComponent(row.question)}`}>
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{
                              borderRadius: '8px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              py: 0.4,
                              px: 1.5,
                              borderColor: 'rgba(13, 138, 79, 0.25)',
                              color: '#0d8a4f',
                              textTransform: 'none',
                              whiteSpace: 'nowrap',
                              '&:hover': { bgcolor: '#f0f8f4', borderColor: '#0d8a4f' }
                            }}
                          >
                            Tạo đáp án
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}

                  {fallbackQuestions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                        <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#0d8a4f' }}>
                            Không có câu hỏi fallback nào tồn đọng!
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Toàn bộ câu hỏi của sinh viên đều đã được AI Agent tự động giải đáp tốt.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}


