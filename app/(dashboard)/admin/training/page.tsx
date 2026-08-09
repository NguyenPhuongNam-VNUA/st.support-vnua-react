'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material';
import {
  Sparkles,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  BrainCircuit,
  MessageSquarePlus,
  Send,
  X,
} from 'lucide-react';

export default function AgentTrainingPage() {
  const [unansweredLogs, setUnansweredLogs] = useState([
    {
      id: 1,
      question: 'Quy trình xin hoãn thi lại môn Cơ sở dữ liệu kỳ này thế nào?',
      asked_count: 28,
      last_asked: '10 phút trước',
      suggested_topic: 'Học vụ',
      agent_confidence: '0.42 (Fallback)',
    },
    {
      id: 2,
      question: 'Hạn nộp học phí bổ sung qua chuyển khoản Agribank đến ngày mấy?',
      asked_count: 22,
      last_asked: '45 phút trước',
      suggested_topic: 'Học phí',
      agent_confidence: '0.38 (Fallback)',
    },
    {
      id: 3,
      question: 'Đăng ký phòng ký túc xá khu B cho tân sinh viên đợt 2 ở đâu?',
      asked_count: 17,
      last_asked: '2 giờ trước',
      suggested_topic: 'Ký túc xá',
      agent_confidence: '0.51 (Fallback)',
    },
  ]);

  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [topicInput, setTopicInput] = useState('Học vụ');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSelectQuestion = (row: any) => {
    setSelectedQuestion(row);
    setAnswerInput('');
    setTopicInput(row.suggested_topic || 'Học vụ');
    setSuccessMsg(false);
  };

  const handlePushToKnowledge = () => {
    if (!selectedQuestion || !answerInput.trim()) return;
    setSuccessMsg(true);
    setTimeout(() => {
      setUnansweredLogs((prev) => prev.filter((q) => q.id !== selectedQuestion.id));
      setSelectedQuestion(null);
      setAnswerInput('');
      setSuccessMsg(false);
    }, 1200);
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1.5} mb={1}>
          <BrainCircuit className="w-7 h-7 text-[#2563eb]" />
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}>
              Huấn luyện & Đóng vòng lặp Tri thức Agent (Agent Training)
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Tự động gom nhóm các câu hỏi agent không chắc/fallback từ log thực tế để biên tập câu trả lời chuẩn
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Main Layout Grid */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1.1fr 0.9fr' }} gap={4}>
        {/* Left Column: Fallback / Low Confidence Question Pool */}
        <Box className="bg-white" p={{ xs: 1.5, sm: 2.5 }} border="1px solid #e2e8f0" sx={{ borderRadius: '8px' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#dc2626', fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
                Hàng chờ câu hỏi cần chuẩn hóa tri thức
              </Typography>
              <span className="px-2 py-0.5 text-xs font-black text-white bg-rose-600 rounded-full">
                {unansweredLogs.length}
              </span>
            </Box>
          </Box>

          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: '#475569', px: { xs: 1, sm: 2 } }}>CÂU HỎI BỊ HỎI NHIỀU</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: '#475569', width: { xs: 55, sm: 80 }, px: { xs: 0.5, sm: 1.5 } }}>LẦN HỎI</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: '#475569', width: { xs: 90, sm: 110 }, px: { xs: 0.5, sm: 1.5 } }}>THAO TÁC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unansweredLogs.map((row) => {
                  const isSelected = selectedQuestion?.id === row.id;
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      selected={isSelected}
                      onClick={() => handleSelectQuestion(row)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6ff !important' : 'inherit',
                      }}
                    >
                      <TableCell sx={{ py: 1.5, px: { xs: 1, sm: 2 } }}>
                        <Typography variant="body2" fontWeight={700} color={isSelected ? '#2563eb' : 'slate.900'} sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
                          {row.question}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.8} mt={0.5} flexWrap="wrap">
                          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Lần gần nhất: {row.last_asked}</span>
                          <span className="text-[10px] sm:text-[11px] text-blue-600 font-semibold">• Tag gợi ý: {row.suggested_topic}</span>
                        </Box>
                      </TableCell>

                      <TableCell align="center" sx={{ px: { xs: 0.5, sm: 1.5 } }}>
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] sm:text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 rounded-full">
                          {row.asked_count}
                        </span>
                      </TableCell>

                      <TableCell align="right" sx={{ px: { xs: 0.5, sm: 1.5 } }}>
                        <Button
                          size="small"
                          variant={isSelected ? 'contained' : 'outlined'}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: { xs: '0.675rem', sm: '0.725rem' },
                            whiteSpace: 'nowrap',
                            px: { xs: 1, sm: 1.8 },
                            py: 0.4,
                            backgroundColor: isSelected ? '#2563eb' : 'transparent',
                            borderColor: '#2563eb',
                            color: isSelected ? '#ffffff' : '#2563eb',
                            '&:hover': {
                              backgroundColor: isSelected ? '#1d4ed8' : '#eff6ff',
                            },
                          }}
                        >
                          Huấn luyện
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {unansweredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="emerald.main" fontWeight={700} sx={{ color: '#059669' }}>
                        🎉 Tất cả câu hỏi thực tế đều đã được Agent tự trả lời thành công!
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>

        {/* Right Column: Training Editor Form */}
        <Box className="bg-white" p={2.5} border="1px solid #e2e8f0" sx={{ borderRadius: '8px' }} display="flex" flexDirection="column" justifyContent="space-between">
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={2.5}>
              <MessageSquarePlus className="w-5 h-5 text-[#2563eb]" />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.05rem' }}>
                Trình soạn thảo câu trả lời chuẩn (Fine-tuning Editor)
              </Typography>
            </Box>

            {selectedQuestion ? (
              <Box display="flex" flexDirection="column" gap={2.5}>
                {/* Active Question Box */}
                <Box p={2} bgcolor="#f8fafc" borderLeft="4px solid #2563eb" borderTop="1px solid #e2e8f0" borderRight="1px solid #e2e8f0" borderBottom="1px solid #e2e8f0" sx={{ borderRadius: '8px' }}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary" display="block" sx={{ letterSpacing: '0.05em' }}>
                    CÂU HỎI ĐANG BIÊN TẬP:
                  </Typography>
                  <Typography variant="body1" fontWeight={800} color="#0f172a" mt={0.5}>
                    &quot;{selectedQuestion.question}&quot;
                  </Typography>
                  <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                    Số sinh viên đã hỏi bị fallback: <strong className="text-rose-600">{selectedQuestion.asked_count} lượt</strong>
                  </span>
                </Box>

                {/* Topic Selector */}
                <FormControl size="small" fullWidth>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5}>
                    Phân loại chủ đề cho RAG Router:
                  </Typography>
                  <Select
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    {['Học vụ', 'Học phí', 'Ký túc xá', 'Tuyển sinh', 'Bảo lưu', 'Khác'].map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Answer Text Input */}
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                    Nội dung đáp án chuẩn hóa cho AI Agent:
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    size="small"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="Ví dụ: Sinh viên nộp đơn xin hoãn thi tại Ban Quản lý Đào tạo trước ngày thi 03 ngày làm việc kèm theo giấy xác nhận lý do..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />
                </Box>

                {successMsg && (
                  <Box display="flex" alignItems="center" gap={1} py={1} px={0.5}>
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#047857' }}>
                      Đã cập nhật thành công vào Knowledge Base & Re-indexed Vector DB!
                    </Typography>
                  </Box>
                )}

                {/* Actions */}
                <Box display="flex" justifyContent="flex-end" gap={1.5} mt={1}>
                  <Button
                    variant="outlined"
                    startIcon={<X className="w-4 h-4" />}
                    onClick={() => setSelectedQuestion(null)}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, borderColor: '#cbd5e1', color: '#475569' }}
                  >
                    Hủy
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Send className="w-4 h-4" />}
                    onClick={handlePushToKnowledge}
                    disabled={!answerInput.trim()}
                    sx={{
                      borderRadius: '8px',
                      backgroundColor: '#2563eb',
                      fontWeight: 700,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 3,
                    }}
                  >
                    Cập nhật vào Tri thức Agent
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box py={10} px={3} textAlign="center" bgcolor="#f8fafc" border="1px solid #e2e8f0" sx={{ borderRadius: '8px' }}>
                <BrainCircuit className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <Typography variant="subtitle2" fontWeight={800} color="slate.800" mb={0.5}>
                  Chưa chọn câu hỏi cần huấn luyện
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={500} maxWidth={320} mx="auto">
                  Chọn một câu hỏi từ hàng chờ bên trái để bắt đầu nhập câu trả lời chuẩn và bổ sung vào RAG Knowledge Base.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

