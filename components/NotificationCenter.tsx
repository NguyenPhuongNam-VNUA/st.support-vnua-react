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
          color: '#475569',
          borderRadius: '9999px',
          p: 1.2,
          border: '1px solid rgba(13, 138, 79, 0.1)',
          bgcolor: '#ffffff',
          boxShadow: '0 2px 8px -2px rgba(13, 138, 79, 0.08)',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: '#f0f8f4',
            color: '#0d8a4f',
            borderColor: 'rgba(13, 138, 79, 0.25)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px -2px rgba(13, 138, 79, 0.16)',
          },
        }}
        aria-label="Thông báo hệ thống"
      >
        <Badge 
          badgeContent={unreadCount} 
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#e11d48',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.65rem',
              boxShadow: '0 0 0 2px #ffffff',
            }
          }}
          overlap="circular"
        >
          <Bell size={19} />
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
            borderRadius: '22px',
            boxShadow: '0 24px 50px -12px rgba(13, 138, 79, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
            border: '1px solid rgba(13, 138, 79, 0.14)',
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
          bgcolor="#fbfdfc" 
          borderBottom="1px solid rgba(13, 138, 79, 0.08)" 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center"
          gap={1.5}
        >
          <Box display="flex" alignItems="center" gap={1.2} sx={{ minWidth: 0 }}>
            <Typography 
              variant="subtitle2" 
              fontWeight={900} 
              sx={{ 
                color: '#0d8a4f', 
                fontSize: '0.95rem', 
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Thông báo hệ thống
            </Typography>
            {unreadCount > 0 && (
              <span className="text-[11px] font-black bg-[#ecfdf5] text-[#0d8a4f] px-2 py-0.5 rounded-full border border-[#a7f3d0] whitespace-nowrap">
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
                fontWeight: 800, 
                color: '#0d8a4f', 
                borderRadius: '9999px',
                px: 1.6,
                py: 0.4,
                bgcolor: '#f0f8f4',
                border: '1px solid rgba(13, 138, 79, 0.15)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': { bgcolor: '#e2f4eb', borderColor: '#0d8a4f' } 
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
                group relative block p-3.5 rounded-2xl border transition-all duration-200 ${
                  item.unread
                    ? 'bg-[#f8fbf9] border-[rgba(13,138,79,0.18)] shadow-2xs hover:bg-[#eef8f2] hover:border-[#10b981]/40 hover:-translate-y-0.5'
                    : 'bg-white border-slate-100 hover:bg-[#fbfdfc] hover:border-[rgba(13,138,79,0.15)] hover:-translate-y-0.5'
                }
              `}
            >
              {/* Header inside card: Title on single row + Unread dot */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[13px] font-black truncate leading-tight ${item.unread ? 'text-slate-900' : 'text-slate-700'}`}>
                  {item.title}
                </span>
                {item.unread && (
                  <span className="w-2 h-2 rounded-full bg-[#10b981] flex-shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                )}
              </div>

              {/* Description */}
              <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed line-clamp-2 mb-2">
                {item.desc}
              </p>

              {/* Footer inside card */}
              <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold">
                <span>{item.time}</span>
                <span className="text-[#0d8a4f] opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                  Xem chi tiết →
                </span>
              </div>
            </Link>
          ))}
        </Box>

        {/* Footer */}
        <Box p={1.5} bgcolor="#fbfdfc" borderTop="1px solid rgba(13, 138, 79, 0.08)" textAlign="center">
          <Link
            href="/admin/conversations"
            onClick={handleClose}
            className="inline-flex items-center justify-center w-full py-2 rounded-full text-xs font-black text-[#0d8a4f] bg-[#f0f8f4] hover:bg-[#e2f4eb] border border-[rgba(13,138,79,0.18)] shadow-2xs transition-all"
          >
            Xem trung tâm nhật ký & hội thoại
          </Link>
        </Box>
      </Popover>
    </>
  );
}


