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
} from 'lucide-react';
import Link from 'next/link';

import trainingApi from '@/api/admin/trainingApi';
import { DateRange } from '@/lib/dashboard/time-range';

interface AgentQualityMetricsProps {
  /** Logs already limited to the dashboard time filter. */
  logs: any[];
  range: DateRange;
  loading?: boolean;
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
      <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-[linear-gradient(180deg,#37475d_0%,#1f2937_64.697%)]"
          style={{
            width: `${Math.min(100, Math.max(0, width))}%`,
            transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        <div
          className="h-full flex-1 rounded-full bg-[#e6e6e6] shadow-[inset_0_0_0_0.444px_#d8d8d8]"
          style={{
            transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </Box>
  );
}

export default function AgentQualityMetrics({ logs, range, loading = false, onDrillDownFallback }: AgentQualityMetricsProps) {
  const [fallbackQuestions, setFallbackQuestions] = React.useState<FallbackItem[]>([]);
  const fromIso = range.from?.toISOString();
  const toIso = range.to.toISOString();

  // Unhandled fallback questions in the window, with suggested topic (questions already in the bank are excluded).
  React.useEffect(() => {
    let alive = true;
    trainingApi
      .getFallbacks({ limit: 5, from: fromIso, to: toIso })
      .then((res: any) => {
        if (!alive) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        setFallbackQuestions(
          rows.map((row: any) => ({
            id: row.id,
            question: row.question,
            category: row.suggested_topic,
            count: row.asked_count,
            last_asked: formatRelativeTime(row.last_asked_at),
          }))
        );
      })
      .catch((err) => console.warn('Lỗi tải câu hỏi fallback cho dashboard:', err));
    return () => {
      alive = false;
    };
  }, [fromIso, toIso]);

  // Compute real metrics from logs
  const total = logs.length;
  const answeredCount = logs.filter(
    (l) => (l.response_type || l.status) === 'answered' || (l.response_type || l.status) === 'auto_generated'
  ).length;
  const fallbackCount = logs.filter(
    (l) => (l.response_type || l.status) === 'not_found'
  ).length;

  const selfPercent = total > 0 ? (answeredCount / total) * 100 : 0;
  const fallbackPercent = total > 0 ? (fallbackCount / total) * 100 : 0;

  // Real feedback / satisfaction calculation
  const ratedLogs = logs.filter((l) => l.feedback || l.rating);
  const ratedCount = ratedLogs.length;
  let posPercent = 0;
  let negPercent = 0;

  if (ratedCount > 0) {
    const posCount = ratedLogs.filter(
      (l) => l.feedback === 'like' || (l.rating && Number(l.rating) >= 4)
    ).length;
    posPercent = (posCount / ratedCount) * 100;
    negPercent = 100 - posPercent;
  }

  return (
    <Grid container spacing={2}>
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
                    <div className="w-8 h-8 rounded-xl bg-[#f3f4f6] border border-[#e5e7eb]/60 flex items-center justify-center text-[#1f2937]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', fontSize: '1.05rem' }}>
                      Tỷ lệ tự trả lời vs Fallback
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={onDrillDownFallback}
                    sx={{ textTransform: 'none', fontWeight: 500, fontSize: '0.75rem', color: '#1f2937', borderRadius: '8px', '&:hover': { bgcolor: '#f3f4f6' } }}
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
                  <Typography variant="caption" fontWeight={500} color="#4b5563" display="block" mb={1}>
                    Agent tự trả lời được
                  </Typography>
                  <Typography variant="h4" fontWeight={500} sx={{ color: '#1f2937' }}>
                    <AnimatedNumber value={selfPercent} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    ({answeredCount} / {total} lượt hỏi)
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" fontWeight={500} color="#4b5563" display="block" mb={1}>
                    Chuyển người thật (fallback)
                  </Typography>
                  <Typography variant="h4" fontWeight={500} sx={{ color: '#1f2937' }}>
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
                <span className="text-xs text-[#6b7280] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1f2937] inline-block" /> Agent tự động giải quyết tốt
                </span>
                <span className="text-xs text-[#6b7280] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#e6e6e6] border border-[#d8d8d8] inline-block" /> Cần bổ sung tri thức
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
                  <div className="w-8 h-8 rounded-xl bg-[#f7f7f7] border border-[#e5e7eb]/80 flex items-center justify-center text-[#4b5563]">
                    <ThumbsUp className="w-4 h-4" />
                  </div>
                  <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', fontSize: '1.05rem' }}>
                    Mức độ hài lòng sinh viên
                  </Typography>
                </Box>
              }
              sx={{ pb: 1, p: 2.5 }}
            />
            <CardContent sx={{ pt: 0, px: 2.5, pb: 2.5 }}>
              <Box display="flex" alignItems="center" gap={3}>
                <Box textAlign="center" py={1.5} px={1.5} minWidth={105} bgcolor="#f8f8f8" borderRadius="14px" border="1px solid rgba(0, 0, 0, 0.08)" boxShadow="0 0 0 1px rgba(255,255,255,0.8) inset">
                  <Typography variant="h3" fontWeight={600} sx={{ color: '#1f2937', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    <AnimatedNumber value={ratedCount} decimals={0} suffix="" />
                  </Typography>
                  <Typography variant="caption" fontWeight={500} color="text.secondary" display="block" mt={0.5}>
                    {loading ? 'Đang tải…' : ratedCount > 0 ? 'lượt đánh giá' : 'Chưa có đánh giá'}
                  </Typography>
                </Box>

                <Box flex={1}>
                  <Box mb={1.5}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" fontWeight={500} color="text.secondary">
                        Đánh giá Tích cực (Hài lòng / Like 👍)
                      </Typography>
                      <Typography variant="caption" fontWeight={500} color="#059669">
                        <AnimatedNumber value={posPercent} />
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={posPercent}
                      sx={{
                        height: 6,
                        borderRadius: '8px',
                        bgcolor: 'rgba(0, 0, 0, 0.05)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(180deg,#37475d 0%,#1f2937 64.697%)',
                          borderRadius: '8px',
                          transition: 'transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" fontWeight={500} color="text.secondary">
                        Đánh giá Tiêu cực (Chưa hài lòng 👎)
                      </Typography>
                      <Typography variant="caption" fontWeight={500} color="#ef4444">
                        <AnimatedNumber value={negPercent} />
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={negPercent}
                      sx={{
                        height: 6,
                        borderRadius: '8px',
                        bgcolor: 'rgba(0, 0, 0, 0.05)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#9ca3af',
                          borderRadius: '8px',
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
                  <div className="w-8 h-8 rounded-xl bg-[#f7f7f7] border border-[#e5e7eb] flex items-center justify-center text-[#ef4444]">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <Box>
                    <Typography variant="h6" fontWeight={600} sx={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.2 }}>
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
                      backgroundColor: '#1f2937',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 2,
                      py: 0.7,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                      '&:hover': { backgroundColor: '#111827' },
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
              <Table size="small" sx={{ minWidth: 520, border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                <TableHead sx={{ backgroundColor: '#f8f8f8' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#1f2937', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>CÂU HỎI BỊ CHỜ / FALLBACK</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#1f2937', width: 100, borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>CHỦ ĐỀ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#1f2937', width: 90, borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>LẦN HỎI</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#1f2937', width: 120, borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>HÀNH ĐỘNG</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fallbackQuestions.map((row) => (
                    <TableRow key={row.id} hover sx={{ transition: 'background-color 0.15s ease', '&:hover': { bgcolor: '#f3f4f6 !important' }, '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ py: 1.5, borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                        <Typography variant="body2" fontWeight={500} color="#1f2937" sx={{ fontSize: '0.825rem' }}>
                          {row.question}
                        </Typography>
                        <span className="text-[11px] text-gray-400 font-medium">Lần hỏi gần nhất: {row.last_asked}</span>
                      </TableCell>

                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                        <Chip
                          label={row.category}
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            backgroundColor: '#f3f4f6',
                            color: '#1f2937',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                          }}
                        />
                      </TableCell>

                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-[#4b5563] bg-[#f7f7f7] border-[0.8px] border-[#e5e7eb] rounded-md">
                          {row.count}
                        </span>
                      </TableCell>

                      <TableCell align="right" sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                        <Link href={`/admin/questions?add=${encodeURIComponent(row.question)}`}>
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{
                              borderRadius: '8px',
                              fontSize: '0.725rem',
                              fontWeight: 500,
                              py: 0.4,
                              px: 1.5,
                              borderColor: 'rgba(0, 0, 0, 0.12)',
                              color: '#1f2937',
                              textTransform: 'none',
                              whiteSpace: 'nowrap',
                              '&:hover': { bgcolor: '#f3f4f6', borderColor: '#1f2937' }
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
                          <CheckCircle2 className="w-8 h-8 text-[#9ca3af]" />
                          <Typography variant="body2" fontWeight={500} sx={{ color: '#1f2937' }}>
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


