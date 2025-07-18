import { useState, useRef, useEffect } from 'react';

// MUI
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import SendIcon from '@mui/icons-material/Send';
import BorderColorIcon from '@mui/icons-material/BorderColor';

import UserMsg from './UserMsg/UserMsg';
import ChatMsg from './ChatMsg/ChatMsg';
import { FlexBetween, FlexBox } from '@/components/flexbox';
import aiApi from '@/api/Ai/aiApi';
import { Tooltip } from '@mui/material';

export default function ChatBot() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  const cleanText = (text) =>
    (text || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .join('\n');

  const handleSend = async () => {
    const userMessage = cleanText(message);
    if (!userMessage) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userMessage },
      { role: 'assistant', text: 'Đang xử lý...' },
    ]);
    setMessage('');

    try {
      const response = await aiApi.askAi({ question: userMessage, messages });
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          text: response.answer || 'Không có phản hồi từ hệ thống.',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          text: 'Xin lỗi bạn, hệ thống đã xảy ra lỗi! Bạn quay lại sau nhé!',
        },
      ]);
      console.error('Error fetching AI response:', err);
    }
  };

  // Tự cuộn xuống nếu đang ở đáy
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <Box
      sx={{
        backgroundColor: '#f4f6f8',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 1000,
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          boxShadow: 3,
        }}
      >
        {/* Header */}
        <FlexBetween padding={3}>
          <FlexBox alignItems="center" gap={1.5}>
            <Avatar src="/st.png" alt="" />
            <Typography variant="body1" fontWeight={600}>
              ST-ChatBot
            </Typography>
          </FlexBox>
        </FlexBetween>

        <Divider />

        {/* Chat content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Scrollable content */}
          <Box
            ref={scrollRef}
            sx={{
              height: '100%',
              overflowY: 'auto',
              px: 3,
              py: 2,
            }}
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 10);
            }}
          >
            <Stack spacing={2}>
              {messages.map((msg, index) => {
                if (msg.role === 'user') return <UserMsg key={index} message={msg.text} />;
                if (msg.role === 'assistant') return <ChatMsg key={index} message={msg.text} />;
                return null;
              })}
              <div ref={bottomRef} />
            </Stack>
          </Box>

          {/* Nút "cuộn xuống" nếu đang lướt lên */}
          {!isAtBottom && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 88,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
            >
              <IconButton
                size="small"
                onClick={() =>
                  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                sx={{
                  backgroundColor: 'background.paper',
                  boxShadow: 1,
                  border: '1px solid #ddd',
                  fontSize: 14,
                  px: 1.5,
                  borderRadius: 2,
                  '&:hover': { backgroundColor: 'grey.100' },
                }}
              >
                ⬇ Mới nhất
              </IconButton>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Input */}
        <Box px={3} py={2} borderTop="1px solid #e0e0e0">
          <FlexBetween>
            <Tooltip title="Mở hội thoại mới" placement="top">
            <IconButton onClick={() => setMessages([])}>
              <BorderColorIcon variant="contained" color='primary' />
            </IconButton>
            </Tooltip>
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={3}
              variant="outlined"
              placeholder="Nhập câu hỏi..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              InputProps={{
                sx: { borderRadius: 2 },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSend} disabled={!message.trim()}>
                      <SendIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </FlexBetween>
        </Box>
      </Card>
    </Box>
  );
}
