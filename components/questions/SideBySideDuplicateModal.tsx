'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  GitCompare,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  PlusCircle,
  Sparkles,
} from 'lucide-react';

interface SideBySideDuplicateModalProps {
  open: boolean;
  onClose: () => void;
  newQuestion: any;
  existingQuestion: any;
  similarityScore: number;
  onResolveAction: (action: 'overwrite' | 'skip' | 'create_new' | 'merge') => void;
}

export default function SideBySideDuplicateModal({
  open,
  onClose,
  newQuestion,
  existingQuestion,
  similarityScore = 88.5,
  onResolveAction,
}: SideBySideDuplicateModalProps) {
  if (!newQuestion || !existingQuestion) return null;

  const scoreColor = similarityScore >= 90 ? '#dc2626' : similarityScore >= 75 ? '#d97706' : '#2563eb';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
          p: 1,
          border: '1px solid #cbd5e1',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.5}>
            <div className="w-10 h-10 rounded-none bg-blue-50 text-[#2563eb] flex items-center justify-center border border-blue-200">
              <GitCompare className="w-5 h-5" />
            </div>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.15rem', lineHeight: 1.2 }}>
                So sánh trùng lặp câu hỏi (Vector Semantic Search)
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Kiểm tra đối chiếu chi tiết để quyết định ghi đè hoặc giữ nguyên dữ liệu huấn luyện
              </Typography>
            </Box>
          </Box>

          <Chip
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label={`${similarityScore.toFixed(1)}% Trùng khớp`}
            sx={{
              borderRadius: 0,
              fontWeight: 800,
              fontSize: '0.825rem',
              backgroundColor: `${scoreColor}15`,
              color: scoreColor,
              border: `1px solid ${scoreColor}40`,
              py: 0.5,
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {/* Left Column: New Question */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box p={2} border="1px solid #93c5fd" bgcolor="#f0f9ff">
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                <span className="text-xs font-black uppercase text-[#2563eb] tracking-wide">CÂU HỎI MỚI (TẢI LÊN / NHẬP)</span>
                <span className="text-[11px] font-bold text-slate-500">Nguồn: Excel / Admin</span>
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                Nội dung câu hỏi:
              </Typography>
              <Typography variant="body2" fontWeight={700} color="slate.900" mb={2} p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
                {newQuestion.question}
              </Typography>

              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                Nội dung câu trả lời gợi ý:
              </Typography>
              <Typography variant="body2" color="slate.800" p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', minHeight: 100 }}>
                {newQuestion.answer || '[Chưa có câu trả lời]'}
              </Typography>
            </Box>
          </Grid>

          {/* Right Column: Existing Question in Database */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box p={2} border="1px solid #fed7aa" bgcolor="#fff7ed">
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                <span className="text-xs font-black uppercase text-[#c2410c] tracking-wide">CÂU HỎI ĐÃ TỒN TẠI TRONG CƠ SỞ DỮ LIỆU</span>
                <span className="text-[11px] font-bold text-slate-500">ID: #{existingQuestion.id || 'DB-104'}</span>
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                Nội dung câu hỏi hiện tại:
              </Typography>
              <Typography variant="body2" fontWeight={700} color="slate.900" mb={2} p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
                {existingQuestion.question || existingQuestion.existing_doc}
              </Typography>

              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                Nội dung câu trả lời hiện tại:
              </Typography>
              <Typography variant="body2" color="slate.800" p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', minHeight: 100 }}>
                {existingQuestion.existing_answer || 'Điểm chuẩn ngành CNTT năm 2024 là 21.5 điểm xét học bạ.'}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Box mt={2.5} p={1.5} bgcolor="#f8fafc" border="1px solid #e2e8f0" display="flex" alignItems="center" gap={1}>
          <ArrowRightLeft className="w-4 h-4 text-slate-500" />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Gợi ý hệ thống: Độ trùng lặp trên 80% có nghĩa là 2 câu hỏi này cùng ý nghĩa ngữ nghĩa. Bạn nên <span className="font-extrabold text-[#2563eb]">Ghi đè</span> hoặc <span className="font-extrabold text-slate-900">Bỏ qua</span>.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 700 }}>
          Đóng
        </Button>

        <Box display="flex" gap={1}>
          <Button
            onClick={() => onResolveAction('skip')}
            variant="outlined"
            color="inherit"
            startIcon={<XCircle className="w-4 h-4" />}
            sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 700 }}
          >
            Bỏ qua (Giữ cũ)
          </Button>

          <Button
            onClick={() => onResolveAction('create_new')}
            variant="outlined"
            color="primary"
            startIcon={<PlusCircle className="w-4 h-4" />}
            sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 700 }}
          >
            Tạo thêm biến thể
          </Button>

          <Button
            onClick={() => onResolveAction('overwrite')}
            variant="contained"
            color="error"
            startIcon={<CheckCircle className="w-4 h-4" />}
            sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 700, backgroundColor: '#dc2626' }}
          >
            Ghi đè câu hỏi cũ
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
