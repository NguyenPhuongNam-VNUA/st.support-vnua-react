'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { Flame, Info } from 'lucide-react';
import conversationApi from "@/api/chatbot/conversationApi";

interface ConversationHeatmapProps {
  logs?: any[];
  onSelectSlot?: (day: string, hour: number) => void;
}

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getDayIndex = (d: Date) => (d.getDay() === 0 ? 6 : d.getDay() - 1);

export default function ConversationHeatmap({ logs: propLogs, onSelectSlot }: ConversationHeatmapProps) {
  const [internalLogs, setInternalLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(!propLogs);

  useEffect(() => {
    if (propLogs) return;
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const res: any = await conversationApi.getAll();
        if (isMounted && res && Array.isArray(res.data)) {
          setInternalLogs(res.data);
        }
      } catch (err) {
        console.warn("Lỗi tải logs cho Heatmap:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchLogs();
    return () => { isMounted = false; };
  }, [propLogs]);

  const activeLogs = propLogs || internalLogs;

  const { heatmapData, maxCount, peakDay, peakHour } = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    let pDay = 'Thứ 2';
    let pHour = 14;

    activeLogs.forEach((log) => {
      if (log.created_at) {
        const d = new Date(log.created_at);
        const dIdx = getDayIndex(d);
        const h = d.getHours();
        if (dIdx >= 0 && dIdx < 7 && h >= 0 && h < 24) {
          grid[dIdx][h] += 1;
          if (grid[dIdx][h] > max) {
            max = grid[dIdx][h];
            pDay = DAYS[dIdx];
            pHour = h;
          }
        }
      }
    });

    return { heatmapData: grid, maxCount: max, peakDay: pDay, peakHour: pHour };
  }, [activeLogs]);

  const getCellColor = (count: number) => {
    if (count === 0) return '#f8fafc';
    if (maxCount <= 4) {
      if (count === 1) return '#bbf7d0';
      if (count <= 2) return '#4ade80';
      return '#0d8a4f';
    }
    const ratio = count / maxCount;
    if (ratio < 0.25) return '#f0fdf4';
    if (ratio < 0.5) return '#bbf7d0';
    if (ratio < 0.75) return '#4ade80';
    return '#0d8a4f';
  };

  const getTextColor = (count: number) => {
    if (maxCount <= 4) return count >= 3 ? '#ffffff' : '#0f291e';
    return (count / maxCount) >= 0.6 ? '#ffffff' : '#0f291e';
  };

  return (
    <Card
      className="emerald-card"
      sx={{
        p: 0,
        bgcolor: '#ffffff',
        mb: 4,
      }}
    >
      <CardHeader
        title={
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <div className="w-8 h-8 rounded-xl bg-[#f0f8f4] border border-[#a7f3d0]/60 flex items-center justify-center text-[#0d8a4f]">
                <Flame className="w-4 h-4 text-[#0d8a4f]" />
              </div>
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', fontSize: '1.05rem', lineHeight: 1.2 }}>
                  Heatmap Mật độ sinh viên hỏi theo khung giờ (24h x 7 ngày)
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  Phân tích thời gian cao điểm thực tế để tối ưu hóa tải trọng máy chủ và hiệu năng AI Agent
                </Typography>
              </Box>
            </Box>

            {/* Intensity Legend */}
            <Box display="flex" alignItems="center" gap={1}>
              <span className="text-[11px] font-bold text-slate-500">Mật độ hỏi:</span>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="w-3.5 h-3.5 bg-[#f8fafc] border border-slate-200 rounded-xs inline-block" /> 0
                <span className="w-3.5 h-3.5 bg-[#f0fdf4] rounded-xs inline-block" /> Thấp
                <span className="w-3.5 h-3.5 bg-[#bbf7d0] rounded-xs inline-block" /> Vừa
                <span className="w-3.5 h-3.5 bg-[#4ade80] rounded-xs inline-block" /> Khá
                <span className="w-3.5 h-3.5 bg-[#0d8a4f] rounded-xs inline-block" /> Peak Load 🔥
              </div>
            </Box>
          </Box>
        }
        sx={{ pb: 1, p: 2.5 }}
      />

      {/* Heatmap Card */}
      <CardContent sx={{ pt: 0, px: 2.5, pb: 2.5, overflowX: 'auto' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={6}>
            <CircularProgress size={32} sx={{ color: '#0d8a4f' }} />
          </Box>
        ) : (
          <Box sx={{ minWidth: 780 }}>
            {/* Top Hours Header */}
            <Box display="grid" gridTemplateColumns="90px repeat(24, 1fr)" gap={0.5} mb={0.8}>
              <div className="text-[11px] font-bold text-slate-400 uppercase self-center tracking-wider">Khung giờ</div>
              {HOURS.map((h) => (
                <div key={h} className="text-[10px] font-extrabold text-slate-500 text-center">
                  {h}h
                </div>
              ))}
            </Box>

            {/* Days Grid Rows */}
            {DAYS.map((day, dIdx) => (
              <Box key={day} display="grid" gridTemplateColumns="90px repeat(24, 1fr)" gap={0.6} mb={0.6}>
                <div className="text-xs font-extrabold text-slate-700 py-1 flex items-center">{day}</div>
                {HOURS.map((h) => {
                  const count = heatmapData[dIdx][h];
                  const isPeak = maxCount > 0 && count === maxCount;
                  return (
                    <Tooltip
                      key={h}
                      title={
                        <Box p={0.5} textAlign="center">
                          <Typography variant="caption" fontWeight={800} display="block" color="#0d8a4f">
                            {day}, {h}:00 - {h + 1}:00
                          </Typography>
                          <Typography variant="body2" fontWeight={700} color={isPeak ? 'error.main' : 'inherit'}>
                            {count} lượt hỏi {isPeak && count > 0 ? '🔥 (Cao điểm nhất)' : ''}
                          </Typography>
                          {count > 0 && (
                            <span className="text-[10px] text-slate-400">Click để lọc danh sách hội thoại khung giờ này</span>
                          )}
                        </Box>
                      }
                      arrow
                    >
                      <Box
                        onClick={() => count > 0 && onSelectSlot && onSelectSlot(day, h)}
                        sx={{
                          height: 28,
                          borderRadius: '6px',
                          backgroundColor: getCellColor(count),
                          color: getTextColor(count),
                          fontSize: '0.675rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: count > 0 ? 'pointer' : 'default',
                          transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          border: '1px solid rgba(13, 138, 79, 0.06)',
                          ...(count > 0 && {
                            '&:hover': {
                              transform: 'scale(1.15)',
                              zIndex: 10,
                              boxShadow: '0 6px 16px -2px rgba(13, 138, 79, 0.25)',
                              borderColor: '#0d8a4f',
                            },
                          }),
                        }}
                      >
                        {count > 0 ? count : ''}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            ))}
          </Box>
        )}

        {/* Peak insight banner */}
        <Box mt={2.5} p={1.8} bgcolor="#fafdfb" border="1px solid rgba(13, 138, 79, 0.12)" sx={{ borderRadius: '12px', boxShadow: '0 0 0 1px rgba(255,255,255,0.8) inset' }} display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.2}>
            <Info className="w-4 h-4 text-[#0d8a4f] flex-shrink-0" />
            {maxCount > 0 ? (
              <Typography variant="caption" fontWeight={700} sx={{ color: '#0d8a4f' }}>
                Gợi ý tối ưu hệ thống: Khung giờ cao điểm sinh viên hỏi nhiều nhất là{' '}
                <span className="font-black text-[#be123c]">{peakDay} lúc {peakHour}:00 - {peakHour + 1}:00</span> ({maxCount} lượt hỏi).
              </Typography>
            ) : (
              <Typography variant="caption" fontWeight={700} sx={{ color: '#0d8a4f' }}>
                Chưa ghi nhận đủ dữ liệu lịch sử hội thoại để xác định khung giờ cao điểm.
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

