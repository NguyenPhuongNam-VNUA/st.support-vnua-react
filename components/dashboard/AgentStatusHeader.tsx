'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  ButtonGroup,
  TextField,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Activity,
  Zap,
  Users,
  Server,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { CartoonAgentRobotIcon } from '@/components/icons/SidebarIcons';

interface AgentStatusHeaderProps {
  timeRange: string;
  setTimeRange: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  onDrillDown?: (filter: string) => void;
}

export default function AgentStatusHeader({
  timeRange,
  setTimeRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onDrillDown,
}: AgentStatusHeaderProps) {
  const [customOpen, setCustomOpen] = useState(timeRange === 'custom');

  const handleRangeClick = (range: string) => {
    setTimeRange(range);
    if (range === 'custom') {
      setCustomOpen(true);
    } else {
      setCustomOpen(false);
    }
  };

  return (
    <Box mb={4}>
      {/* 1. ACADEMIC EMERALD HERO BANNER (White Background with Green Border) */}
      <Box 
        sx={{
          borderRadius: '22px',
          p: { xs: 3, sm: 3.5, md: 4 },
          mb: 3.5,
          bgcolor: '#ffffff',
          boxShadow: '0 8px 30px -6px rgba(13, 138, 79, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
          border: '1px solid rgba(13, 138, 79, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box 
          display="flex" 
          flexDirection={{ xs: 'column', lg: 'row' }} 
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', lg: 'center' }} 
          gap={3}
          position="relative"
          zIndex={1}
        >
          {/* Left Hero Content */}
          <Box display="flex" alignItems="flex-start" gap={2.5}>
            {/* Robot Icon Placed Directly */}
            <CartoonAgentRobotIcon size={44} className="text-[#0d8a4f] flex-shrink-0 transition-transform hover:scale-105" />
            <Box>
              <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" mb={0.5}>
                <Typography
                  variant="h4"
                  fontWeight={900}
                  sx={{ 
                    color: '#0d8a4f', 
                    letterSpacing: '-0.025em', 
                    fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
                    lineHeight: 1.2
                  }}
                >
                  Trung Tâm Điều Hành AI Agent
                </Typography>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#f0f8f4] text-[#0d8a4f] border border-[rgba(16,185,129,0.3)] shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  REAL-TIME OPERATIONAL
                </span>
              </Box>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, maxWidth: 620, fontSize: { xs: '0.825rem', sm: '0.875rem' }, lineHeight: 1.5 }}>
                Hệ thống giám sát hiệu năng, luồng hội thoại sinh viên, tỷ lệ RAG retrieval và chất lượng giải đáp của AI Agent khoa CNTT.
              </Typography>
            </Box>
          </Box>

          {/* Right Global Time Filter Controls */}
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems={{ xs: 'flex-start', lg: 'flex-end' }} 
            gap={1.5}
            className="w-full lg:w-auto"
          >
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Khoảng thời gian:
              </span>
              <ButtonGroup 
                size="small" 
                sx={{ 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  bgcolor: '#f8fafc',
                  border: '1px solid rgba(13, 138, 79, 0.15)',
                  p: '3px'
                }}
              >
                {[
                  { id: 'today', label: 'Hôm nay' },
                  { id: '7d', label: '7 ngày' },
                  { id: '30d', label: '30 ngày' },
                  { id: 'custom', label: 'Tuỳ chọn' },
                ].map((item) => (
                  <Button
                    key={item.id}
                    onClick={() => handleRangeClick(item.id)}
                    sx={{
                      borderRadius: '9px',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      textTransform: 'none',
                      px: { xs: 1.4, sm: 1.8 },
                      py: 0.6,
                      border: 'none !important',
                      backgroundColor: timeRange === item.id ? '#0d8a4f' : 'transparent',
                      color: timeRange === item.id ? '#ffffff' : '#64748b',
                      boxShadow: timeRange === item.id ? '0 2px 8px rgba(13, 138, 79, 0.25)' : 'none',
                      '&:hover': {
                        backgroundColor: timeRange === item.id ? '#0a7543' : '#f0f8f4',
                        color: timeRange === item.id ? '#ffffff' : '#0d8a4f',
                      },
                      transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>

            {/* Custom Date Picker Dropdown */}
            {customOpen && (
              <Box 
                display="flex" 
                alignItems="center" 
                gap={1} 
                flexWrap="wrap" 
                sx={{ 
                  bgcolor: '#ffffff', 
                  p: 1.2, 
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(13, 138, 79, 0.08)',
                  border: '1px solid rgba(13, 138, 79, 0.15)'
                }}
              >
                <Calendar className="w-4 h-4 text-[#0d8a4f]" />
                <TextField
                  type="date"
                  size="small"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  sx={{
                    width: { xs: 120, sm: 135 },
                    '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, color: '#0f172a', fontWeight: 600 },
                    '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f8fafc', borderColor: 'rgba(13, 138, 79, 0.2)' },
                  }}
                />
                <span className="text-xs font-bold text-slate-600">đến</span>
                <TextField
                  type="date"
                  size="small"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  sx={{
                    width: { xs: 120, sm: 135 },
                    '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, color: '#0f172a', fontWeight: 600 },
                    '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f8fafc', borderColor: 'rgba(13, 138, 79, 0.2)' },
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* 4 Real-time KPI Cards - Equal Height & Width */}
      <Grid container spacing={2.5} alignItems="stretch">
        {/* Card 1: Agent Status */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: 'flex' }}>
          <Card
            className="emerald-card"
            sx={{
              p: 0,
              bgcolor: '#ffffff',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
              border: '1px solid rgba(13, 138, 79, 0.12)',
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', '&:last-child': { pb: 2.5 } }}>
              {/* Top Section */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Trạng thái AI Agent
                  </Typography>
                  <Activity className="w-5 h-5 text-[#0d8a4f]" />
                </Box>
                <Box display="flex" alignItems="center" gap={1.2} mb={0.5}>
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em' }}>
                    Hoạt động
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  RAG Pipeline & Model Online
                </Typography>
              </Box>

              {/* Bottom Section - Consistent Baseline */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={2} pt={1.5} borderTop="1px solid rgba(13, 138, 79, 0.06)">
                <span className="text-[11px] text-emerald-800 font-bold bg-[#f0f8f4] px-2.5 py-0.5 rounded-full border border-[#a7f3d0]/80">
                  Uptime 99.9%
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Average Latency */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: 'flex' }}>
          <Card
            className="emerald-card"
            sx={{
              p: 0,
              bgcolor: '#ffffff',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
              border: '1px solid rgba(13, 138, 79, 0.12)',
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', '&:last-child': { pb: 2.5 } }}>
              {/* Top Section */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Độ trễ trung bình
                  </Typography>
                  <Zap className="w-5 h-5 text-[#0d8a4f]" />
                </Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em', mb: 0.5 }}>
                  1.15 giây
                </Typography>
                <Typography variant="caption" fontWeight={700} display="block" sx={{ color: '#10b981' }}>
                  ⚡ Nhanh hơn 12% so với tuần trước
                </Typography>
              </Box>

              {/* Bottom Section - Consistent Baseline */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={2} pt={1.5} borderTop="1px solid rgba(13, 138, 79, 0.06)">
                <span className="text-[11px] text-slate-500 font-semibold">Embedding latency: 180ms</span>
                <Clock className="w-4 h-4 text-slate-400" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Active Sessions */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: 'flex' }}>
          <Card
            onClick={() => onDrillDown && onDrillDown('active')}
            className="emerald-card cursor-pointer"
            sx={{
              p: 0,
              bgcolor: '#ffffff',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
              border: '1px solid rgba(13, 138, 79, 0.12)',
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', '&:last-child': { pb: 2.5 } }}>
              {/* Top Section */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Phiên đang hoạt động
                  </Typography>
                  <Users className="w-5 h-5 text-[#0d8a4f]" />
                </Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em', mb: 0.5 }}>
                  18 phiên
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  Sinh viên đang hỏi đáp real-time
                </Typography>
              </Box>

              {/* Bottom Section - Consistent Baseline */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={2} pt={1.5} borderTop="1px solid rgba(13, 138, 79, 0.06)">
                <span className="text-[11px] text-slate-500 font-semibold">Max concurrent: 120</span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: System Resource / RAG Memory */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: 'flex' }}>
          <Card
            className="emerald-card"
            sx={{
              p: 0,
              bgcolor: '#ffffff',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
              border: '1px solid rgba(13, 138, 79, 0.12)',
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', '&:last-child': { pb: 2.5 } }}>
              {/* Top Section */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bộ nhớ Vector DB
                  </Typography>
                  <Server className="w-5 h-5 text-[#0d8a4f]" />
                </Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em', mb: 0.5 }}>
                  1,420 Chunks
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  Đã index chuẩn ChromaDB 100%
                </Typography>
              </Box>

              {/* Bottom Section - Consistent Baseline */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={2} pt={1.5} borderTop="1px solid rgba(13, 138, 79, 0.06)">
                <span className="text-[11px] text-slate-500 font-semibold">FAISS / ChromaDB Engine</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
