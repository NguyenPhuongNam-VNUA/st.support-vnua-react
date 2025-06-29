import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import SendIcon from '@mui/icons-material/Send';
import Container from '@mui/material/Container';

import { useState } from 'react';
import aiApi from '@/api/Ai/aiApi';

function ChatBot() {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);

    const handleSend = async () => {
        if (message.trim()) {
            const userMessage = message.trim();
            console.log('Gửi:', message);
            // setMessage('');
            
            setMessages((prevMessages) => [
                ...prevMessages,
                { role: 'user', text: message },
                { role: 'assistant', text: 'Đang xử lý...' }
            ]);

            // Gọi API AI để lấy câu trả lời
            try {
                const response = await aiApi.askAi({ question: userMessage });
                console.log('Nhận:', response);
                setMessages((prevMessages) => [
                    ...prevMessages.slice(0, -1), // Loại bỏ tin nhắn " role: 'assistant', text: 'Đang xử lý...'"
                    { role: 'assistant', text: response.answer || '[Không có phản hồi]' }
                ]);
            } catch (error) {
                console.error(error);
                setMessages((prevMessages) => [
                    ...prevMessages.slice(0, -1),
                    { role: 'assistant', text: 'Đã xảy ra lỗi khi gọi API.' }
                ]);
            }

            setMessage(''); // Xóa ô nhập sau khi gửi
        }
    };

    return (
        <>
            <Container maxWidth="md" sx={{ marginTop: '50px' }}>
                <Box>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Nhập câu hỏi của bạn..."
                        sx={{ marginBottom: 2 }}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={ handleSend}
                                            disabled={message.trim() === ''}
                                            color="primary"
                                        >
                                            <SendIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />  
                </Box>
                <Box
                    sx={{
                        height: '400px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: 2,
                        overflowY: 'auto',
                        backgroundColor: '#f9f9f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                    }}
                >
                    {messages.map((msg, index) => (
                        <Box
                        key={ index }
                        sx={{
                            alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                            backgroundColor: msg.role === 'user' ? '#e0f7fa' : '#c8e6c9',
                            color: '#000',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            maxWidth: '50%',
                            wordBreak: 'break-word',
                        }}
                        >
                        {msg.text}
                        </Box>
                    ))}
                </Box>
            </Container>
        </>
    );
}

export default ChatBot;