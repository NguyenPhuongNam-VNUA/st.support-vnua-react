'use client';

import React, { useState } from 'react';
import {
  Popover,
  Box,
  Typography,
  IconButton,
  Badge,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Chip,
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
      title: 'Cảnh báo: Tỷ lệ Fallback tăng bất thường',
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
          '&:hover': { backgroundColor: '#edf4fc', color: '#2563eb' },
        }}
      >
        <Badge badgeContent={unreadCount} color="error" overlap="circular">
          <Bell size={20} />
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
            width: 360,
            borderRadius: '12px',
            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            mt: 1,
          },
        }}
      >
        {/* Header */}
        <Box p={2} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={800} color="slate.900" sx={{ fontSize: '0.875rem' }}>
              Thông báo hệ thống
            </Typography>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                {unreadCount} mới
              </span>
            )}
          </Box>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead} sx={{ textTransform: 'none', fontSize: '0.725rem', fontWeight: 700, color: '#2563eb' }}>
              Đánh dấu đã đọc
            </Button>
          )}
        </Box>

        {/* Notification List */}
        <List sx={{ p: 0, maxHeight: 340, overflow: 'auto' }}>
          {notifications.map((item, index) => (
            <React.Fragment key={item.id}>
              <ListItem
                component={Link}
                href={item.link}
                onClick={handleClose}
                sx={{
                  backgroundColor: item.unread ? '#f8fafc' : '#ffffff',
                  '&:hover': { backgroundColor: '#f1f5f9' },
                  px: 2.5,
                  py: 1.75,
                  display: 'flex',
                  alignItems: 'flex-start',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Box flex={1}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {item.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#2563eb] flex-shrink-0" />
                      )}
                      <Typography variant="body2" fontWeight={item.unread ? 800 : 600} color="slate.900" sx={{ fontSize: '0.85rem', lineHeight: 1.3 }}>
                        {item.title}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.775rem', lineHeight: 1.4, mb: 0.75, color: '#475569' }}>
                    {item.desc}
                  </Typography>

                  <span className="text-[11px] text-slate-400 font-medium display-block">
                    {item.time}
                  </span>
                </Box>
              </ListItem>
              {index < notifications.length - 1 && <Divider sx={{ borderColor: '#f1f5f9' }} />}
            </React.Fragment>
          ))}
        </List>
      </Popover>
    </>
  );
}
