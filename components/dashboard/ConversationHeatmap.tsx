'use client';

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';
import { Flame, Info } from 'lucide-react';

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
        count = Math.floor(((hour * 7 + dIdx * 3) % 8)); // Deterministic formula
      }
      row.push(Math.max(0, count));
    });
    grid.push(row);
  });
  return grid;
};

const HEATMAP_DATA = generateHeatmapData();

export default function ConversationHeatmap({ onSelectSlot }: ConversationHeatmapProps) {
  const getCellColor = (count: number) => {
    if (count === 0) return '#f8fafc';
    if (count < 15) return '#f0fdf4'; // Light Mint 50
    if (count < 40) return '#bbf7d0'; // Mint 200
    if (count < 70) return '#4ade80'; // Emerald 400
    return '#0d8a4f'; // Refined Soft Emerald Peak
  };

  const getTextColor = (count: number) => {
    return count >= 40 ? '#ffffff' : '#0f291e';
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
                  Phân tích thời gian cao điểm để tối ưu hóa tải trọng máy chủ và tốc độ sinh phản hồi của AI
                </Typography>
              </Box>
            </Box>

            {/* Intensity Legend */}
            <Box display="flex" alignItems="center" gap={1}>
              <span className="text-[11px] font-bold text-slate-500">Mật độ hỏi:</span>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="w-3.5 h-3.5 bg-[#f8fafc] border border-slate-200 rounded-xs inline-block" /> Thấp
                <span className="w-3.5 h-3.5 bg-[#f0fdf4] rounded-xs inline-block" /> Vừa
                <span className="w-3.5 h-3.5 bg-[#bbf7d0] rounded-xs inline-block" /> Khá
                <span className="w-3.5 h-3.5 bg-[#4ade80] rounded-xs inline-block" /> Cao
                <span className="w-3.5 h-3.5 bg-[#0d8a4f] rounded-xs inline-block" /> Peak Load 🔥
              </div>
            </Box>
          </Box>
        }
        sx={{ pb: 1, p: 2.5 }}
      />

      {/* Heatmap Card */}
      <CardContent sx={{ pt: 0, px: 2.5, pb: 2.5, overflowX: 'auto' }}>
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
                const count = HEATMAP_DATA[dIdx][h];
                const isPeak = count >= 70;
                return (
                  <Tooltip
                    key={h}
                    title={
                      <Box p={0.5} textAlign="center">
                        <Typography variant="caption" fontWeight={800} display="block" color="#0d8a4f">
                          {day}, {h}:00 - {h + 1}:00
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color={isPeak ? 'error.main' : 'inherit'}>
                          {count} lượt hỏi {isPeak ? '🔥 (Cao điểm)' : ''}
                        </Typography>
                        <span className="text-[10px] text-slate-400">Click để lọc danh sách hội thoại</span>
                      </Box>
                    }
                    arrow
                  >
                    <Box
                      onClick={() => onSelectSlot && onSelectSlot(day, h)}
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
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        border: '1px solid rgba(13, 138, 79, 0.06)',
                        '&:hover': {
                          transform: 'scale(1.15)',
                          zIndex: 10,
                          boxShadow: '0 6px 16px -2px rgba(13, 138, 79, 0.25)',
                          borderColor: '#0d8a4f',
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
        <Box mt={2.5} p={1.8} bgcolor="#fafdfb" border="1px solid rgba(13, 138, 79, 0.12)" sx={{ borderRadius: '12px', boxShadow: '0 0 0 1px rgba(255,255,255,0.8) inset' }} display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.2}>
            <Info className="w-4 h-4 text-[#0d8a4f] flex-shrink-0" />
            <Typography variant="caption" fontWeight={700} sx={{ color: '#0d8a4f' }}>
              Gợi ý tối ưu hệ thống: Khung giờ cao điểm tập trung vào <span className="font-black text-[#be123c]">Thứ 3 lúc 14:00 - 15:00</span> (88 lượt hỏi/h) và các buổi tối lúc 20:00.
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

