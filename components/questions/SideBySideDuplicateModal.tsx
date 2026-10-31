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

  const scoreColor = similarityScore >= 90 ? '#ef4444' : similarityScore >= 75 ? '#4b5563' : '#4b5563';

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
          border: '1px solid #d1d5db',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.5}>
            <div className="w-10 h-10 rounded-none bg-[#f7f7f7] text-[#4b5563] flex items-center justify-center border border-[#e5e7eb]">
              <GitCompare className="w-5 h-5" />
            </div>
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ color: '#4b5563', fontSize: '1.15rem', lineHeight: 1.2 }}>
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
              fontWeight: 600,
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
            <Box p={2} border="1px solid #e5e7eb" bgcolor="#f7f7f7">
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                <span className="text-xs font-semibold uppercase text-[#4b5563] tracking-wide">CÂU HỎI MỚI (TẢI LÊN / NHẬP)</span>
                <span className="text-[11px] font-medium text-gray-500">Nguồn: Excel / Admin</span>
              </Box>

              <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
                Nội dung câu hỏi:
              </Typography>
              <Typography variant="body2" fontWeight={500} color="slate.900" mb={2} p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}>
                {newQuestion.question}
              </Typography>

              <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
                Nội dung câu trả lời gợi ý:
              </Typography>
              <Typography variant="body2" color="slate.800" p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', minHeight: 100 }}>
                {newQuestion.answer || '[Chưa có câu trả lời]'}
              </Typography>
            </Box>
          </Grid>

          {/* Right Column: Existing Question in Database */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box p={2} border="1px solid #e5e7eb" bgcolor="#f7f7f7">
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                <span className="text-xs font-semibold uppercase text-[#4b5563] tracking-wide">CÂU HỎI ĐÃ TỒN TẠI TRONG CƠ SỞ DỮ LIỆU</span>
                <span className="text-[11px] font-medium text-gray-500">ID: #{existingQuestion.id || 'DB-104'}</span>
              </Box>

              <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
                Nội dung câu hỏi hiện tại:
              </Typography>
              <Typography variant="body2" fontWeight={500} color="slate.900" mb={2} p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}>
                {existingQuestion.question || existingQuestion.existing_doc}
              </Typography>

              <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
                Nội dung câu trả lời hiện tại:
              </Typography>
              <Typography variant="body2" color="slate.800" p={1.5} sx={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', minHeight: 100 }}>
                {existingQuestion.existing_answer || 'Điểm chuẩn ngành CNTT năm 2024 là 21.5 điểm xét học bạ.'}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Box mt={2.5} p={1.5} bgcolor="#f8f8f8" border="1px solid #e5e7eb" display="flex" alignItems="center" gap={1}>
          <ArrowRightLeft className="w-4 h-4 text-gray-500" />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Gợi ý hệ thống: Độ trùng lặp trên 80% có nghĩa là 2 câu hỏi này cùng ý nghĩa ngữ nghĩa. Bạn nên <span className="font-semibold text-[#4b5563]">Ghi đè</span> hoặc <span className="font-semibold text-gray-900">Bỏ qua</span>.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 500 }}>
          Đóng
        </Button>

        <Box display="flex" gap={1}>
          <Button
            onClick={() => onResolveAction('skip')}
            variant="outlined"
            color="inherit"
            startIcon={<XCircle className="w-4 h-4" />}
            sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 500 }}
          >
            Bỏ qua (Giữ cũ)
          </Button>

          <Button
            onClick={() => onResolveAction('create_new')}
            variant="outlined"
            color="primary"
            startIcon={<PlusCircle className="w-4 h-4" />}
            sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 500 }}
          >
            Tạo thêm biến thể
          </Button>

          <Button
            onClick={() => onResolveAction('overwrite')}
            variant="contained"
            color="error"
            startIcon={<CheckCircle className="w-4 h-4" />}
            sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 500, backgroundColor: '#ef4444' }}
          >
            Ghi đè câu hỏi cũ
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
