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
  Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ShieldAlert,
  ThumbsUp,
  RotateCcw,
  PlusCircle,
  HelpCircle,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Star,
} from 'lucide-react';
import Link from 'next/link';

interface AgentQualityMetricsProps {
  onDrillDownFallback?: () => void;
}

function AnimatedNumber({ value, decimals = 1, suffix = '%' }: { value: number; decimals?: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200;

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
      <div className="h-3.5 w-full bg-rose-100 rounded-none overflow-hidden flex">
        <div
          className="bg-emerald-600 h-full"
          style={{
            width: `${width}%`,
            transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        <div
          className="bg-rose-500 h-full flex-1"
          style={{
            transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </Box>
  );
}

export default function AgentQualityMetrics({ onDrillDownFallback }: AgentQualityMetricsProps) {
  const [animProgressPos, setAnimProgressPos] = React.useState(0);
  const [animProgressNeg, setAnimProgressNeg] = React.useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setAnimProgressPos(94.2);
      setAnimProgressNeg(5.8);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Mock data for top unanswered / fallback questions
  const UNANSWERED_QUESTIONS = [
    {
      id: 1,
      question: 'Quy trình xin hoãn thi lại môn Cơ sở dữ liệu kỳ này thế nào?',
      category: 'Học vụ',
      count: 28,
      last_asked: '10 phút trước',
    },
    {
      id: 2,
      question: 'Hạn nộp học phí bổ sung qua chuyển khoản Agribank đến ngày mấy?',
      category: 'Học phí',
      count: 22,
      last_asked: '45 phút trước',
    },
    {
      id: 3,
      question: 'Đăng ký phòng ký túc xá khu B cho tân sinh viên đợt 2 ở đâu?',
      category: 'Ký túc xá',
      count: 17,
      last_asked: '2 giờ trước',
    },
    {
      id: 4,
      question: 'Điều kiện xin bảo lưu học tập 1 năm khoa CNTT?',
      category: 'Học vụ',
      count: 14,
      last_asked: '5 giờ trước',
    },
  ];

  return (
    <Grid container spacing={3} mb={4}>
      {/* Left Column: Quality & Satisfaction Cards */}
      <Grid size={{ xs: 12, lg: 5 }}>
        <Box display="flex" flexDirection="column" gap={3} height="100%">
          {/* Card 1: Self-Answered vs Human Fallback Ratio */}
          <Card
            sx={{
              borderRadius: 0,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              p: 1,
            }}
          >
            <CardHeader
              title={
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.05rem' }}>
                      Tỷ lệ tự trả lời vs Fallback
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={onDrillDownFallback}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: '#2563eb' }}
                  >
                    Xem hội thoại →
                  </Button>
                </Box>
              }
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 1 }}>
              {/* Stat percentages */}
              <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={1}>
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    AGENT TỰ TRẢ LỜI ĐƯỢC
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ color: '#059669', letterSpacing: '-0.02em' }}>
                    <AnimatedNumber value={88.5} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    (885 / 1,000 lượt)
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    CHUYỂN NGƯỜI THẬT (FALLBACK)
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ color: '#dc2626', letterSpacing: '-0.02em' }}>
                    <AnimatedNumber value={11.5} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    (115 / 1,000 lượt)
                  </Typography>
                </Box>
              </Box>

              {/* Progress Bar Visual with smooth width animation */}
              <AnimatedProgressBar selfPercent={88.5} />

              <Box display="flex" justifyContent="space-between" mt={1}>
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Agent tự động giải quyết tốt
                </span>
                <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Cần bổ sung tri thức
                </span>
              </Box>
            </CardContent>
          </Card>

          {/* Card 2: Average Satisfaction Rating */}
          <Card
            sx={{
              borderRadius: 0,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              p: 1,
              flex: 1,
            }}
          >
            <CardHeader
              title={
                <Box display="flex" alignItems="center" gap={1.5}>
                  <ThumbsUp className="w-5 h-5 text-amber-600" />
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.05rem' }}>
                    Mức độ hài lòng sinh viên
                  </Typography>
                </Box>
              }
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 1 }}>
              <Box display="flex" alignItems="center" gap={3}>
                <Box textAlign="center" py={1} px={1} minWidth={100}>
                  <Typography variant="h3" fontWeight={900} sx={{ color: '#2563eb', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    <AnimatedNumber value={4.8} decimals={1} suffix="" />
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
                    trên 5.0 <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 inline-block" />
                  </Typography>
                </Box>

                <Box flex={1}>
                  <Box mb={1}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Đánh giá Tích cực (Hài lòng / Like 👍)
                      </Typography>
                      <Typography variant="caption" fontWeight={800} color="success.main">
                        <AnimatedNumber value={94.2} />
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={animProgressPos}
                      color="success"
                      sx={{
                        height: 6,
                        borderRadius: 0,
                        '& .MuiLinearProgress-bar': {
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
                      <Typography variant="caption" fontWeight={800} color="error.main">
                        <AnimatedNumber value={5.8} />
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={animProgressNeg}
                      color="error"
                      sx={{
                        height: 6,
                        borderRadius: 0,
                        '& .MuiLinearProgress-bar': {
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

      {/* Right Column: Top Unanswered Questions (Critical for Knowledge Base Improvement) */}
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card
          sx={{
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            p: 1,
            height: '100%',
          }}
        >
          <CardHeader
            title={
              <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" gap={1.5}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#dc2626', fontSize: { xs: '0.95rem', sm: '1.05rem' }, lineHeight: 1.2 }}>
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
                      borderRadius: '8px',
                      backgroundColor: '#2563eb',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 2,
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      '&:hover': { backgroundColor: '#1d4ed8' },
                    }}
                  >
                    Bổ sung tri thức
                  </Button>
                </Link>
              </Box>
            }
            sx={{ pb: 1 }}
          />

          <CardContent sx={{ pt: 1, px: { xs: 1, sm: 2 } }}>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 520, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569' }}>CÂU HỎI BỊ CHỜ / FALLBACK</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 100 }}>CHỦ ĐỀ</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 90 }}>LẦN HỎI</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 120 }}>HÀNH ĐỘNG</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {UNANSWERED_QUESTIONS.map((row) => (
                  <TableRow key={row.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={600} color="slate.900" sx={{ fontSize: '0.825rem' }}>
                        {row.question}
                      </Typography>
                      <span className="text-[11px] text-slate-400 font-medium">Lần hỏi gần nhất: {row.last_asked}</span>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={row.category}
                        size="small"
                        sx={{
                          borderRadius: '9999px',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: 'none',
                        }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-black text-rose-700 bg-rose-50 rounded-full">
                        {row.count}
                      </span>
                    </TableCell>

                    <TableCell align="right">
                      <Link href={`/admin/questions?add=${encodeURIComponent(row.question)}`}>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{
                            borderRadius: '8px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            py: 0.5,
                            px: 1.5,
                            borderColor: '#2563eb',
                            color: '#2563eb',
                            textTransform: 'none',
                            whiteSpace: 'nowrap',
                            minWidth: 'fit-content',
                          }}
                        >
                          Tạo đáp án
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
