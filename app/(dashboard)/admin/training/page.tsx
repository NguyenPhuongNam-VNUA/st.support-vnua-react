'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  BrainCircuit,
  MessageSquarePlus,
  Send,
  X,
} from 'lucide-react';
import { TrainingBookingIcon } from '@/components/icons/SidebarIcons';
import conversationApi from '@/api/chatbot/conversationApi';
import questionApi from '@/api/admin/questionApi';

function formatRelativeTime(dateStr: string) {
  if (!dateStr) return 'Vừa xong';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

export default function AgentTrainingPage() {
  const [unansweredLogs, setUnansweredLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [topicInput, setTopicInput] = useState('Học vụ');
  const [isPublishing, setIsPublishing] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchFallbackQuestions = async () => {
      try {
        const res: any = await conversationApi.getAll();
        const logs = res && Array.isArray(res.data) ? res.data : [];
        const map = new Map<string, { id: number; question: string; asked_count: number; lastDate: string; suggested_topic: string }>();
        for (const log of logs) {
          const status = log.response_type || log.status;
          if (status === 'not_found' && log.question?.trim()) {
            const q = log.question.trim();
            const existing = map.get(q);
            if (existing) {
              existing.asked_count += 1;
              if (new Date(log.created_at).getTime() > new Date(existing.lastDate).getTime()) {
                existing.lastDate = log.created_at;
              }
            } else {
              map.set(q, {
                id: log.id,
                question: q,
                asked_count: 1,
                lastDate: log.created_at,
                suggested_topic: 'Học vụ',
              });
            }
          }
        }
        if (isMounted) {
          setUnansweredLogs(
            Array.from(map.values())
              .sort((a, b) => b.asked_count - a.asked_count)
              .map((item) => ({
                id: item.id,
                question: item.question,
                asked_count: item.asked_count,
                last_asked: formatRelativeTime(item.lastDate),
                suggested_topic: item.suggested_topic,
              }))
          );
        }
      } catch (err) {
        console.warn('Lỗi tải câu hỏi fallback:', err);
      } finally {
        if (isMounted) setLoadingLogs(false);
      }
    };
    fetchFallbackQuestions();
    return () => { isMounted = false; };
  }, []);

  const handleSelectQuestion = (q: any) => {
    setSelectedQuestion(q);
    setTopicInput(q.suggested_topic || 'Học vụ');
    setAnswerInput('');
    setSuccessMsg(false);
  };

  const handlePublishToKnowledgeBase = async () => {
    if (!answerInput.trim() || !selectedQuestion) return;

    setIsPublishing(true);
    try {
      await questionApi.add({
        question: selectedQuestion.question,
        answer: answerInput.trim(),
        topic: topicInput,
        status: 'approved',
      });
      setSuccessMsg(true);
      setUnansweredLogs((prev) => prev.filter((q) => q.id !== selectedQuestion.id));
      setSelectedQuestion(null);
      setAnswerInput('');
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err) {
      console.error('Lỗi khi lưu tri thức vào ngân hàng câu hỏi:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={3.5}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Custom SVG Icon Placed Directly without Div Wrapper */}
          <TrainingBookingIcon size={42} className="text-[#0d8a4f] flex-shrink-0 transition-transform hover:scale-105" />
          <Box>
            <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.02em', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              Huấn Luyện & Chuẩn Hóa Tri Thức Agent (Active Learning)
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Tự động gom nhóm các câu hỏi thực tế sinh viên hỏi bị fallback để biên tập đáp án chuẩn hóa cho RAG Knowledge Base
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Main Layout Grid */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1.1fr 0.9fr' }} gap={3.5}>
        {/* Left Column: Fallback / Low Confidence Question Pool */}
        <Box className="emerald-card" p={{ xs: 2, sm: 3 }} bgcolor="#ffffff">
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1.2}>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#be123c', fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
                Hàng chờ câu hỏi cần chuẩn hóa tri thức
              </Typography>
              <span className="px-2.5 py-0.5 text-xs font-black text-white bg-rose-600 rounded-full shadow-xs">
                {unansweredLogs.length}
              </span>
            </Box>
          </Box>

          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ width: '100%', border: '1px solid rgba(0, 60, 30, 0.08)', borderRadius: '14px', overflow: 'hidden' }}>
              <TableHead sx={{ backgroundColor: '#fafdfb' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: '#0d8a4f', px: { xs: 1, sm: 2 }, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>CÂU HỎI BỊ HỎI NHIỀU</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: '#0d8a4f', width: { xs: 55, sm: 80 }, px: { xs: 0.5, sm: 1.5 }, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>LẦN HỎI</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: '#0d8a4f', width: { xs: 90, sm: 110 }, px: { xs: 0.5, sm: 1.5 }, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>THAO TÁC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingLogs ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0d8a4f' }} />
                      <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b', fontWeight: 600 }}>
                        Đang rà soát các câu hỏi fallback từ lịch sử hội thoại...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
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
                            transition: 'background-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            backgroundColor: isSelected ? '#f0f8f4 !important' : 'inherit',
                            '&:last-child td': { borderBottom: 0 },
                          }}
                        >
                          <TableCell sx={{ py: 1.5, px: { xs: 1, sm: 2 }, borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                            <Typography variant="body2" fontWeight={700} color={isSelected ? '#0d8a4f' : '#0f291e'} sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
                              {row.question}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.8} mt={0.5} flexWrap="wrap">
                              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Lần gần nhất: {row.last_asked}</span>
                              <span className="text-[10px] sm:text-[11px] text-[#0d8a4f] font-semibold bg-[#f0f8f4] px-1.5 py-0.2 rounded border border-[#a7f3d0]/60">• Chủ đề: {row.suggested_topic}</span>
                            </Box>
                          </TableCell>

                          <TableCell align="center" sx={{ px: { xs: 0.5, sm: 1.5 }, borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] sm:text-xs font-black text-rose-700 bg-rose-50 border border-rose-200/80 rounded-full">
                              {row.asked_count}
                            </span>
                          </TableCell>

                          <TableCell align="right" sx={{ px: { xs: 0.5, sm: 1.5 }, borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
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
                                backgroundColor: isSelected ? '#0d8a4f' : 'transparent',
                                borderColor: isSelected ? '#0d8a4f' : 'rgba(13, 138, 79, 0.25)',
                                color: isSelected ? '#ffffff' : '#0d8a4f',
                                '&:hover': {
                                  backgroundColor: isSelected ? '#0a7543' : '#f0f8f4',
                                  borderColor: '#0d8a4f',
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
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#0d8a4f' }}>
                            🎉 Tất cả câu hỏi thực tế đều đã được Agent tự giải đáp chính xác!
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>

        {/* Right Column: Training Editor Form */}
        <Box className="emerald-card" p={{ xs: 2.5, sm: 3.5 }} bgcolor="#ffffff" display="flex" flexDirection="column" justifyContent="space-between">
          <Box>
            <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
              <div className="w-8 h-8 rounded-xl bg-[#f0f8f4] text-[#0d8a4f] flex items-center justify-center border border-[#a7f3d0]/60">
                <MessageSquarePlus className="w-4 h-4" />
              </div>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', fontSize: '1.05rem' }}>
                Trình soạn thảo đáp án chuẩn (Fine-tuning Editor)
              </Typography>
            </Box>

            {selectedQuestion ? (
              <Box display="flex" flexDirection="column" gap={2.5}>
                {/* Active Question Box */}
                <Box p={2.2} bgcolor="#fafdfb" borderLeft="4px solid #0d8a4f" borderTop="1px solid rgba(13, 138, 79, 0.08)" borderRight="1px solid rgba(13, 138, 79, 0.08)" borderBottom="1px solid rgba(13, 138, 79, 0.08)" sx={{ borderRadius: '14px', boxShadow: '0 0 0 1px rgba(255,255,255,0.8) inset' }}>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" display="block" sx={{ letterSpacing: '0.05em' }}>
                    CÂU HỎI ĐANG BIÊN TẬP:
                  </Typography>
                  <Typography variant="body1" fontWeight={800} color="#0f291e" mt={0.5}>
                    &quot;{selectedQuestion.question}&quot;
                  </Typography>
                  <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                    Số sinh viên đã hỏi bị fallback: <strong className="text-rose-600">{selectedQuestion.asked_count} lượt</strong>
                  </span>
                </Box>

                {/* Topic Selector */}
                <FormControl size="small" fullWidth>
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" mb={0.5}>
                    Phân loại chủ đề cho RAG Router:
                  </Typography>
                  <Select
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    sx={{ 
                      borderRadius: '12px',
                      bgcolor: '#fbfdfc',
                      '& fieldset': { borderColor: 'rgba(13, 138, 79, 0.08)' },
                      '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.28)' },
                      '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)' },
                      '&.Mui-focused fieldset': { borderColor: '#0d8a4f' }
                    }}
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
                  <Typography variant="caption" fontWeight={800} color="#0d8a4f" mb={0.5} display="block">
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
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: '12px',
                        bgcolor: '#fbfdfc',
                        '& fieldset': { borderColor: 'rgba(13, 138, 79, 0.08)' },
                        '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.28)' },
                        '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)' },
                        '&.Mui-focused fieldset': { borderColor: '#0d8a4f' }
                      } 
                    }}
                  />
                </Box>

                {successMsg && (
                  <Box display="flex" alignItems="center" gap={1} py={1.2} px={1.8} bgcolor="#f0f8f4" border="1px solid rgba(16, 185, 129, 0.3)" borderRadius="12px" boxShadow="0 0 0 1px rgba(255,255,255,0.8) inset">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <Typography variant="body2" fontWeight={800} sx={{ color: '#0d8a4f' }}>
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
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, borderColor: 'rgba(0, 0, 0, 0.12)', color: '#475569', '&:hover': { bgcolor: '#f1f5f9' } }}
                  >
                    Hủy
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Send className="w-4 h-4" />}
                    onClick={handlePublishToKnowledgeBase}
                    disabled={isPublishing || !answerInput.trim()}
                    sx={{
                      borderRadius: '10px',
                      backgroundColor: '#0d8a4f',
                      fontWeight: 700,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      px: 3,
                      boxShadow: '0 4px 12px rgba(13, 138, 79, 0.2)',
                      '&:hover': { backgroundColor: '#0a7543' },
                      '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' }
                    }}
                  >
                    {isPublishing ? 'Đang cập nhật...' : 'Cập nhật vào Tri thức Agent'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box py={10} px={3} textAlign="center" bgcolor="#fafdfb" border="1px dashed rgba(13, 138, 79, 0.2)" sx={{ borderRadius: '16px' }}>
                <BrainCircuit className="w-12 h-12 text-emerald-500/70 mx-auto mb-3" />
                <Typography variant="subtitle2" fontWeight={800} color="#0d8a4f" mb={0.5}>
                  Chưa chọn câu hỏi cần huấn luyện
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={500} maxWidth={340} mx="auto">
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


