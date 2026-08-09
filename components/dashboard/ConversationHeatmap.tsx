'use client';

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Tooltip,
  Chip,
  Button,
} from '@mui/material';
import { Clock, Flame, Info, Filter } from 'lucide-react';

interface ConversationHeatmapProps {
  onSelectSlot?: (day: string, hour: number) => void;
}

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Generate deterministic peak mock data for peak student ask hours (e.g. 9-11h, 14-16h, 20-22h)
const generateHeatmapData = () => {
  const grid: number[][] = [];
  DAYS.forEach((_, dIdx) => {
    const row: number[] = [];
    HOURS.forEach((hour) => {
      let count = 0;
      if ((hour >= 8 && hour <= 11) || (hour >= 13 && hour <= 16) || (hour >= 19 && hour <= 21)) {
        count = Math.floor(Math.sin(hour * 0.8 + dIdx) * 35 + 40);
        if (dIdx === 1 && hour === 14) count = 88; // Peak load on Tue 14h
      } else {
        count = Math.floor(((hour * 7 + dIdx * 3) % 8)); // Deterministic formula instead of Math.random() to prevent SSR hydration mismatch
      }
      row.push(Math.max(0, count));
    });
    grid.push(row);
  });
  return grid;
};

const HEATMAP_DATA = generateHeatmapData();

export default function ConversationHeatmap({ onSelectSlot }: ConversationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; count: number } | null>(null);

  const getCellColor = (count: number) => {
    if (count === 0) return '#f8fafc';
    if (count < 15) return '#dbeafe';
    if (count < 40) return '#93c5fd';
    if (count < 70) return '#3b82f6';
    return '#1d4ed8'; // Peak
  };

  const getTextColor = (count: number) => {
    return count > 35 ? '#ffffff' : '#1e293b';
  };

  return (
    <Card
      sx={{
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        p: 1,
        mb: 4,
      }}
    >
      <CardHeader
        title={
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Flame className="w-5 h-5 text-indigo-600" />
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.05rem', lineHeight: 1.2 }}>
                  Heatmap Thời gian sinh viên hỏi nhiều nhất (24h x 7 ngày)
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  Phân tích khung giờ cao điểm để tối ưu hóa tài nguyên server và phản hồi của AI
                </Typography>
              </Box>
            </Box>

            {/* Intensity Legend */}
            <Box display="flex" alignItems="center" gap={1}>
              <span className="text-[11px] font-bold text-slate-500">Mật độ hỏi:</span>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <span className="w-4 h-4 bg-[#f8fafc] border border-slate-200 inline-block" /> Thấp
                <span className="w-4 h-4 bg-[#93c5fd] inline-block" /> Vừa
                <span className="w-4 h-4 bg-[#3b82f6] inline-block" /> Cao
                <span className="w-4 h-4 bg-[#1d4ed8] inline-block" /> Peak Load 🔥
              </div>
            </Box>
          </Box>
        }
        sx={{ pb: 1 }}
      />

      <CardContent sx={{ pt: 1, overflowX: 'auto' }}>
        <Box sx={{ minWidth: 780 }}>
          {/* Top Hours Header */}
          <Box display="grid" gridTemplateColumns="90px repeat(24, 1fr)" gap={0.5} mb={0.5}>
            <div className="text-[11px] font-bold text-slate-400 uppercase self-center">Khung giờ</div>
            {HOURS.map((h) => (
              <div key={h} className="text-[10px] font-extrabold text-slate-500 text-center">
                {h}h
              </div>
            ))}
          </Box>

          {/* Days Grid Rows */}
          {DAYS.map((day, dIdx) => (
            <Box key={day} display="grid" gridTemplateColumns="90px repeat(24, 1fr)" gap={0.5} mb={0.5}>
              <div className="text-xs font-bold text-slate-700 py-1.5 flex items-center">{day}</div>
              {HOURS.map((h) => {
                const count = HEATMAP_DATA[dIdx][h];
                const isPeak = count >= 70;
                return (
                  <Tooltip
                    key={h}
                    title={
                      <Box p={0.5} textAlign="center">
                        <Typography variant="caption" fontWeight={800} display="block">
                          {day}, {h}:00 - {h + 1}:00
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color={isPeak ? 'error.light' : 'inherit'}>
                          {count} lượt hỏi {isPeak ? '🔥 (Cao điểm)' : ''}
                        </Typography>
                        <span className="text-[10px] text-slate-300">Click để xem danh sách hội thoại</span>
                      </Box>
                    }
                    arrow
                  >
                    <Box
                      onClick={() => onSelectSlot && onSelectSlot(day, h)}
                      sx={{
                        height: 28,
                        backgroundColor: getCellColor(count),
                        color: getTextColor(count),
                        fontSize: '0.675rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: '1px solid rgba(226, 232, 240, 0.5)',
                        '&:hover': {
                          transform: 'scale(1.15)',
                          zIndex: 10,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          borderColor: '#2563eb',
                        },
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

        {/* Peak insight banner */}
        <Box mt={2} p={1.5} className="bg-blue-50" border="1px solid #bfdbfe" sx={{ borderRadius: '8px' }} display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Info className="w-4 h-4 text-[#2563eb]" />
            <Typography variant="caption" fontWeight={700} sx={{ color: '#1e3a8a' }}>
              Gợi ý tối ưu server: Khung giờ cao điểm lớn nhất diễn ra vào <span className="font-extrabold text-red-600">Thứ 3 lúc 14:00 - 15:00</span> (88 lượt/h) và các buổi tối lúc 20:00.
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
