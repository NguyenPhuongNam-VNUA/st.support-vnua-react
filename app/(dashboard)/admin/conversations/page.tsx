'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Drawer,
  IconButton,
} from '@mui/material';
import { X, Bot, User } from 'lucide-react';
import ConversationCard from '@/components/dashboard/cards/ConversationCard';
import { CartoonHistoryClockArrowIcon } from '@/components/icons/SidebarIcons';

export default function DetailedConversationsPage() {
  const [selectedTranscript, setSelectedTranscript] = useState<any | null>(null);

  const MOCK_FULL_TRANSCRIPT = [
    { sender: 'user', text: 'Chào chatbot, cho em hỏi học phí ngành CNTT năm nay bao nhiêu 1 tín chỉ?', time: '14:20:05' },
    { sender: 'bot', text: 'Chào bạn! Học phí ngành Công nghệ thông tin năm 2025 là 450.000đ/tín chỉ đối với môn đại cương và 520.000đ/tín chỉ với môn chuyên ngành.', time: '14:20:06', context: 'Quy chế Học phí 2025' },
    { sender: 'user', text: 'Hạn nộp đợt 1 là khi nào vậy ạ?', time: '14:20:40' },
    { sender: 'bot', text: 'Hạn nộp học phí đợt 1 là trước ngày 30/09/2025 qua cổng thanh toán VNUA hoặc tài khoản ngân hàng Agribank Học viện.', time: '14:20:41', context: 'Thông báo Học phí' },
  ];

  return (
    <Box p={1}>
      <Box mb={3.5} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={2}>
          {/* Custom SVG Icon Placed Directly without Div Wrapper */}
          <CartoonHistoryClockArrowIcon size={42} className="text-[#0d8a4f] flex-shrink-0 transition-transform hover:scale-105" />
          <Box>
            <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.02em', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              Lịch Sử Hội Thoại & Chi Tiết Transcript
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Tra cứu đầy đủ log chat thực tế giữa sinh viên và AI Agent với bộ lọc nâng cao
            </Typography>
          </Box>
        </Box>
      </Box>

      <ConversationCard noCardContainer={true} />

      {/* Transcript Viewer Drawer */}
      <Drawer
        anchor="right"
        open={!!selectedTranscript}
        onClose={() => setSelectedTranscript(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 0, borderRadius: { xs: 0, sm: '16px 0 0 16px' } } }}
      >
        <Box p={2.5} sx={{ background: 'linear-gradient(135deg, #0d8a4f 0%, #10b981 100%)' }} color="#ffffff" display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1.5}>
            <Bot className="w-6 h-6 text-emerald-100" />
            <Typography variant="h6" fontWeight={800} color="#ffffff">
              Chi Tiết Hội Thoại Đầy Đủ
            </Typography>
          </Box>
          <IconButton onClick={() => setSelectedTranscript(null)} sx={{ color: '#ffffff', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            <X className="w-5 h-5" />
          </IconButton>
        </Box>

        <Box p={3} flex={1} overflow="auto" bgcolor="#f8fafc">
          <Box display="flex" flexDirection="column" gap={2.5}>
            {MOCK_FULL_TRANSCRIPT.map((msg, index) => (
              <Box key={index} display="flex" flexDirection="column" alignItems={msg.sender === 'user' ? 'flex-end' : 'flex-start'}>
                <span className="text-[11px] text-slate-500 font-semibold mb-1 flex items-center gap-1">
                  {msg.sender === 'user' ? <User className="w-3 h-3 text-[#0d8a4f]" /> : <Bot className="w-3 h-3 text-emerald-600" />}
                  {msg.sender === 'user' ? 'Sinh viên' : 'AI Agent VNUA'} • {msg.time}
                </span>
                <Box
                  p={2}
                  bgcolor={msg.sender === 'user' ? '#0d8a4f' : '#ffffff'}
                  color={msg.sender === 'user' ? '#ffffff' : '#0f172a'}
                  border={msg.sender === 'user' ? 'none' : '1px solid rgba(13, 138, 79, 0.1)'}
                  borderRadius="14px"
                  boxShadow={msg.sender === 'user' ? '0 4px 12px rgba(0, 104, 55, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.04)'}
                  maxWidth="85%"
                >
                  <Typography variant="body2" fontWeight={msg.sender === 'user' ? 500 : 600}>{msg.text}</Typography>
                  {msg.context && (
                    <span className="block text-[10px] italic mt-1.5 text-emerald-700 bg-[#f0fdf4] p-1 rounded border border-[#a7f3d0]">
                      Trích dẫn tài liệu: {msg.context}
                    </span>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}

