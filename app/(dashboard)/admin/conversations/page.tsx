'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Drawer,
  IconButton,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import { MessageSquareText, Eye, X, User, Bot, Clock, Filter } from 'lucide-react';
import ConversationCard from '@/components/dashboard/cards/ConversationCard';

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
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}>
            Trang Lịch sử Hội thoại & Transcript Chi tiết
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Tra cứu đầy đủ log chat thực tế giữa sinh viên và AI Agent với bộ lọc nâng cao
          </Typography>
        </Box>
      </Box>

      <ConversationCard noCardContainer={true} />

      {/* Transcript Viewer Drawer */}
      <Drawer
        anchor="right"
        open={!!selectedTranscript}
        onClose={() => setSelectedTranscript(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 500 }, p: 0, borderRadius: 0 } }}
      >
        <Box p={2.5} bgcolor="#2563eb" color="#ffffff" display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={800} color="#ffffff">
            Full Conversation Transcript
          </Typography>
          <IconButton onClick={() => setSelectedTranscript(null)} sx={{ color: '#ffffff' }}>
            <X className="w-5 h-5" />
          </IconButton>
        </Box>

        <Box p={3} flex={1} overflow="auto">
          <Box display="flex" flexDirection="column" gap={2}>
            {MOCK_FULL_TRANSCRIPT.map((msg, index) => (
              <Box key={index} display="flex" flexDirection="column" alignItems={msg.sender === 'user' ? 'flex-end' : 'flex-start'}>
                <span className="text-[11px] text-slate-400 font-medium mb-1">
                  {msg.sender === 'user' ? 'Sinh viên' : 'AI Agent'} • {msg.time}
                </span>
                <Box
                  p={2}
                  bgcolor={msg.sender === 'user' ? '#2563eb' : '#f1f5f9'}
                  color={msg.sender === 'user' ? '#ffffff' : '#0f172a'}
                  border={msg.sender === 'user' ? 'none' : '1px solid #e2e8f0'}
                  maxWidth="85%"
                >
                  <Typography variant="body2">{msg.text}</Typography>
                  {msg.context && (
                    <span className="block text-[10px] italic mt-1 text-slate-500 border-t pt-1">
                      Retrieved Context: {msg.context}
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
