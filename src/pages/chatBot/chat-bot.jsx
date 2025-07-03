import { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import aiApi from '@/api/Ai/aiApi';

function ChatBot() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSend = async () => {
    const userMessage = message.trim();
    if (!userMessage) return;

    // Thêm tin nhắn người dùng và loading
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userMessage },
      { role: 'assistant', text: 'Đang xử lý...' },
    ]);

    setMessage('');

    try {
      const response = await aiApi.askAi({ question: userMessage });
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
        { role: 'assistant', text: 'Đã xảy ra lỗi khi gọi API.' },
      ]);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper
        elevation={3}
        sx={{
          marginTop: 6,
          padding: 3,
          borderRadius: 3,
          backgroundColor: '#ffffff',
        }}
      >
        <Typography variant="h6" fontWeight={600} mb={2}>
          💬 ChatBot hỗ trợ sinh viên
        </Typography>

        {/* Hộp chat hiển thị tin nhắn */}
        <Box
          sx={{
            height: 400,
            overflowY: 'auto',
            backgroundColor: '#f9f9f9',
            borderRadius: 2,
            padding: 2,
            mb: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {messages.map((msg, index) => (
            <Box
              key={index}
              sx={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#c8e6c9',
                color: '#000',
                padding: '8px 12px',
                borderRadius: 2,
                maxWidth: '75%',
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
            </Box>
          ))}
        </Box>

        {/* Ô nhập + nút gửi */}
        <TextField
          fullWidth
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
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSend} disabled={!message.trim()}>
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>
    </Container>
  );
}

export default ChatBot;
