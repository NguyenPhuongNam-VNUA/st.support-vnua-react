'use client';

import React, { useState } from 'react';
import {
  Popover,
  Box,
  Typography,
  IconButton,
  Badge,
  Button,
} from '@mui/material';
import { Bell } from 'lucide-react';
import Link from 'next/link';

export default function NotificationCenter() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Có 4 câu hỏi mới chờ duyệt',
      desc: 'Sinh viên vừa đặt câu hỏi liên quan đến hoãn thi lại.',
      time: '5 phút trước',
      type: 'question',
      link: '/admin/questions',
      unread: true,
    },
    {
      id: 2,
      title: 'Cảnh báo: Tỷ lệ Fallback cần chú ý',
      desc: 'Tỷ lệ câu hỏi chưa có câu trả lời đạt 11.5% trong 1 giờ qua.',
      time: '30 phút trước',
      type: 'alert',
      link: '/admin/training',
      unread: true,
    },
    {
      id: 3,
      title: 'Tài liệu PDF vừa hoàn thành Embedding',
      desc: 'Quy chế Đào tạo v2.1 đã sẵn sàng phục vụ RAG Agent.',
      time: '2 giờ trước',
      type: 'document',
      link: '/admin/documents',
      unread: false,
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          color: '#4b5563',
          borderRadius: '6px',
          p: 0.5,
          m: -0.5,
          transition: 'background-color .15s ease-out, transform .15s ease-out',
          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
          '&:active': { transform: 'scale(0.97)' },
        }}
        aria-label="Thông báo hệ thống"
      >
        <Badge
          variant="dot"
          invisible={unreadCount === 0}
          sx={{ '& .MuiBadge-badge': { backgroundColor: '#ef4444', boxShadow: '0 0 0 1.5px #ffffff' } }}
          overlap="circular"
        >
          <Bell size={16} strokeWidth={1.6} />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 380 },
            borderRadius: '12px',
            boxShadow: '0 24px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
            mt: 1.2,
            bgcolor: '#ffffff',
          },
        }}
      >
        {/* Header - Single Row, No Icon, White Space Nowrap */}
        <Box 
          px={2.5}
          py={2}
          bgcolor="#f8f8f8" 
          borderBottom="1px solid rgba(0, 0, 0, 0.08)" 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center"
          gap={1.5}
        >
          <Box display="flex" alignItems="center" gap={1.2} sx={{ minWidth: 0 }}>
            <Typography 
              variant="subtitle2" 
              fontWeight={600} 
              sx={{ 
                color: '#1f2937', 
                fontSize: '0.95rem', 
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Thông báo hệ thống
            </Typography>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold bg-[#f3f4f6] text-[#1f2937] px-2 py-0.5 rounded-full border border-[#e5e7eb] whitespace-nowrap">
                {unreadCount} mới
              </span>
            )}
          </Box>

          {unreadCount > 0 && (
            <Button 
              size="small" 
              onClick={markAllRead} 
              sx={{ 
                textTransform: 'none', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#1f2937', 
                borderRadius: '8px',
                px: 1.6,
                py: 0.4,
                bgcolor: '#f3f4f6',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': { bgcolor: '#f3f4f6', borderColor: '#1f2937' } 
              }}
            >
              Đã đọc
            </Button>
          )}
        </Box>

        {/* Notification Cards List (No Icon, Single Row Title & Clean Spacing) */}
        <Box 
          sx={{ 
            p: 1.8, 
            maxHeight: 380, 
            overflowY: 'auto',
            scrollbarWidth: 'none', // Firefox
            '&::-webkit-scrollbar': { display: 'none' }, // Chrome, Safari, Edge
            msOverflowStyle: 'none', // IE
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
          }}
        >
          {notifications.map((item) => (
            <Link
              key={item.id}
              href={item.link}
              onClick={handleClose}
              className={`
                group relative block p-3.5 rounded-xl border transition-all duration-200 ${
                  item.unread
                    ? 'bg-[#f8f8f8] border-[rgba(0, 0, 0, 0.12)] shadow-2xs hover:bg-[#f3f4f6] hover:border-[#059669]/40 hover:-translate-y-0.5'
                    : 'bg-white border-gray-100 hover:bg-[#f8f8f8] hover:border-[rgba(0, 0, 0, 0.12)] hover:-translate-y-0.5'
                }
              `}
            >
              {/* Header inside card: Title on single row + Unread dot */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[13px] font-semibold truncate leading-tight ${item.unread ? 'text-gray-900' : 'text-gray-700'}`}>
                  {item.title}
                </span>
                {item.unread && (
                  <span className="w-2 h-2 rounded-full bg-[#059669] flex-shrink-0 shadow-[0_0_6px_rgba(0, 0, 0, 0.12)]" />
                )}
              </div>

              {/* Description */}
              <p className="text-[11.5px] text-gray-500 font-medium leading-relaxed line-clamp-2 mb-2">
                {item.desc}
              </p>

              {/* Footer inside card */}
              <div className="flex items-center justify-between text-[10.5px] text-gray-400 font-semibold">
                <span>{item.time}</span>
                <span className="text-[#1f2937] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Xem chi tiết →
                </span>
              </div>
            </Link>
          ))}
        </Box>

        {/* Footer */}
        <Box p={1.5} bgcolor="#f8f8f8" borderTop="1px solid rgba(0, 0, 0, 0.08)" textAlign="center">
          <Link
            href="/admin/conversations"
            onClick={handleClose}
            className="inline-flex items-center justify-center w-full py-2 rounded-full text-xs font-semibold text-[#1f2937] bg-[#f3f4f6] hover:bg-[#f3f4f6] border border-[rgba(0, 0, 0, 0.12)] shadow-2xs transition-all"
          >
            Xem trung tâm nhật ký & hội thoại
          </Link>
        </Box>
      </Popover>
    </>
  );
}


