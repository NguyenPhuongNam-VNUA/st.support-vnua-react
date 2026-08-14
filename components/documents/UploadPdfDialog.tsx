'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
} from '@mui/material';
import { UploadCloud, FileText, X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

const schema = yup.object().shape({
  title: yup.string().required('Tiêu đề không được để trống'),
  description: yup.string(),
  file: yup
    .mixed()
    .test('is-pdf', 'File phải là PDF', (value: any) => {
      return value && value.type === 'application/pdf';
    })
    .required('Phải chọn file PDF'),
});

export default function UploadPdfDialog({ open, onClose, onSubmit }: any) {
  const { control, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      file: null,
    },
    resolver: yupResolver(schema),
  });

  const selectedFile = watch('file') as any;

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFormSubmit = (data: any) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('file', data.file);

    onSubmit(formData);
    reset();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(8px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '24px',
          p: 1.5,
          backgroundColor: '#ffffff',
          boxShadow: '0 30px 60px -15px rgba(13, 138, 79, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
          border: '1px solid rgba(13, 138, 79, 0.15)',
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <UploadCloud className="w-6 h-6 text-[#0d8a4f]" />
          <Box>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.02em', fontSize: '1.25rem' }}>
              Tải lên tài liệu PDF
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Nạp tài liệu quy chế, học phí hoặc thông báo mới vào RAG Knowledge Base
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 1 }}>
        <Box display="flex" flexDirection="column" gap={2.5} mt={1}>
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                fullWidth
                size="small"
                label="Tiêu đề tài liệu"
                placeholder="VD: Quy chế Đào tạo và Học phí 2025"
                error={!!error}
                helperText={error?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#f8fbf9',
                    '&.Mui-focused fieldset': { borderColor: '#0d8a4f' },
                  },
                }}
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Mô tả tóm tắt nội dung"
                placeholder="Nhập ghi chú hoặc phạm vi áp dụng của tài liệu..."
                multiline
                rows={3}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#f8fbf9',
                    '&.Mui-focused fieldset': { borderColor: '#0d8a4f' },
                  },
                }}
              />
            )}
          />

          {/* Upload Area */}
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadCloud className="w-5 h-5" />}
            sx={{
              py: 2.5,
              borderRadius: '14px',
              border: '2px dashed rgba(13, 138, 79, 0.35)',
              backgroundColor: '#f0f8f4',
              color: '#0d8a4f',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: '#e2f4eb',
                borderColor: '#0d8a4f',
              },
            }}
          >
            {selectedFile ? 'Thay đổi file PDF khác' : 'Chọn file PDF từ thiết bị'}
            <input
              type="file"
              hidden
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setValue('file', file as any);
                }
              }}
            />
          </Button>

          {selectedFile && (
            <Box
              display="flex"
              alignItems="center"
              gap={1.5}
              p={1.5}
              borderRadius="12px"
              bgcolor="#f0f8f4"
              border="1px solid rgba(13, 138, 79, 0.2)"
            >
              <FileText className="w-5 h-5 text-[#0d8a4f] flex-shrink-0" />
              <Box flex={1} minWidth={0}>
                <Typography variant="body2" fontWeight={800} color="#0d8a4f" noWrap>
                  {selectedFile.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • File PDF hợp lệ
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, gap: 1.5 }}>
        <Button
          onClick={handleClose}
          sx={{
            borderRadius: '9999px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 800,
            color: '#475569',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            '&:hover': { bgcolor: '#f0f8f4', color: '#0d8a4f' },
          }}
        >
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit(onFormSubmit)}
          sx={{
            borderRadius: '9999px',
            px: 3.5,
            py: 1,
            textTransform: 'none',
            fontWeight: 800,
            backgroundColor: '#0d8a4f',
            color: '#ffffff',
            boxShadow: '0 4px 14px -2px rgba(13, 138, 79, 0.35)',
            '&:hover': {
              backgroundColor: '#0a7543',
              boxShadow: '0 6px 18px -2px rgba(13, 138, 79, 0.45)',
            },
          }}
        >
          Lưu & Nạp Vector
        </Button>
      </DialogActions>
    </Dialog>
  );
}

