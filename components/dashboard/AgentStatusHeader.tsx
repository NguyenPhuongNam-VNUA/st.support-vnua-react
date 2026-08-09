'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  ButtonGroup,
  TextField,
  Tooltip,
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
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

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
      {/* Top Bar: Title & Global Time Filter */}
      <Box
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        gap={2}
        mb={3}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Sparkles className="w-7 h-7 text-[#2563eb]" />
          <Box>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ color: '#2563eb', letterSpacing: '-0.02em', fontSize: { xs: '1.5rem', sm: '1.875rem' } }}
              >
                Trung tâm Điều hành AI Agent
              </Typography>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                OPERATIONAL
              </span>
            </Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Giám sát hiệu năng, độ trễ và chất lượng phản hồi real-time
            </Typography>
          </Box>
        </Box>

        {/* Global Time Filter Controls */}
        <Box display="flex" flexDirection="column" alignItems={{ xs: 'flex-start', md: 'flex-end' }} gap={1}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Thời gian:
            </Typography>
            <ButtonGroup size="small" variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
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
                    borderRadius: 0,
                    fontWeight: 700,
                    fontSize: '0.775rem',
                    textTransform: 'none',
                    px: { xs: 1, sm: 1.8 },
                    py: 0.6,
                    borderColor: '#cbd5e1',
                    backgroundColor: timeRange === item.id ? '#2563eb' : '#ffffff',
                    color: timeRange === item.id ? '#ffffff' : '#475569',
                    '&:hover': {
                      backgroundColor: timeRange === item.id ? '#1d4ed8' : '#f1f5f9',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          {/* Custom Date Picker Dropdown */}
          {customOpen && (
            <Box display="flex" alignItems="center" gap={1} mt={1} flexWrap="wrap" className="bg-slate-50" p={1} border="1px dashed #cbd5e1" sx={{ borderRadius: '8px' }}>
              <Calendar className="w-4 h-4 text-slate-500" />
              <TextField
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                sx={{
                  width: { xs: 120, sm: 140 },
                  '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 },
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                }}
              />
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                đến
              </Typography>
              <TextField
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                sx={{
                  width: { xs: 120, sm: 140 },
                  '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 },
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                }}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Real-time Agent Status Cards Grid */}
      <Grid container spacing={2}>
        {/* Card 1: Agent Status & Engine Info */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card
            onClick={() => onDrillDown && onDrillDown('all')}
            sx={{
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', borderColor: '#2563eb' },
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Trạng thái AI Server
                </Typography>
                <Activity className="w-5 h-5 text-emerald-600" />
              </Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping inline-block" />
                <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                  ONLINE
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                Engine: Gemini 1.5 Flash + RAG
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={1.5} pt={1} borderTop="1px solid #f1f5f9">
                <span className="text-[11px] text-slate-500 font-semibold">Uptime 99.9%</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Average Latency */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: '#2563eb' },
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Độ trễ trung bình
                </Typography>
                <Zap className="w-5 h-5 text-blue-600" />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}>
                1.15 giây
              </Typography>
              <Typography variant="caption" color="emerald.main" fontWeight={600} display="block" sx={{ color: '#059669' }}>
                ⚡ Nhanh hơn 12% so với tuần trước
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={1.5} pt={1} borderTop="1px solid #f1f5f9">
                <span className="text-[11px] text-slate-500 font-semibold">Embedding latency: 180ms</span>
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Active Sessions */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card
            onClick={() => onDrillDown && onDrillDown('active')}
            sx={{
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', borderColor: '#2563eb' },
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Phiên đang hoạt động
                </Typography>
                <Users className="w-5 h-5 text-indigo-600" />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#4f46e5', letterSpacing: '-0.02em' }}>
                18 phiên
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                Sinh viên đang tương tác chatbot
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={1.5} pt={1} borderTop="1px solid #f1f5f9">
                <span className="text-[11px] text-slate-500 font-semibold">Max concurrent: 120</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: System Resource / RAG Memory */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: '#2563eb' },
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Bộ nhớ Vector DB
                </Typography>
                <Server className="w-5 h-5 text-purple-600" />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#7c3aed', letterSpacing: '-0.02em' }}>
                1,420 Chunks
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                Đã index thành công 100%
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={1.5} pt={1} borderTop="1px solid #f1f5f9">
                <span className="text-[11px] text-slate-500 font-semibold">FAISS / ChromaDB Engine</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
