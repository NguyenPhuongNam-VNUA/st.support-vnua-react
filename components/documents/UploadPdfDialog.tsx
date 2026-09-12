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
  MenuItem,
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

const metadataFields = [
  { name: 'document_number', label: 'Số/ký hiệu văn bản', placeholder: 'VD: 123/QĐ-HVN' },
  { name: 'issuer', label: 'Cơ quan ban hành', placeholder: 'VD: Học viện Nông nghiệp Việt Nam' },
  { name: 'issuing_unit', label: 'Đơn vị ban hành', placeholder: 'VD: Ban Quản lý đào tạo' },
  { name: 'academic_year', label: 'Năm học', placeholder: 'VD: 2026-2027' },
  { name: 'semester', label: 'Học kỳ', placeholder: 'VD: Học kỳ 1' },
  { name: 'audiences', label: 'Đối tượng áp dụng', placeholder: 'Phân cách bằng dấu phẩy' },
  { name: 'education_levels', label: 'Bậc đào tạo', placeholder: 'Đại học, Sau đại học' },
  { name: 'study_modes', label: 'Hình thức đào tạo', placeholder: 'Chính quy, Vừa làm vừa học' },
  { name: 'faculties', label: 'Khoa áp dụng', placeholder: 'Phân cách bằng dấu phẩy' },
  { name: 'programs', label: 'Chương trình áp dụng', placeholder: 'Phân cách bằng dấu phẩy' },
  { name: 'campuses', label: 'Cơ sở áp dụng', placeholder: 'Phân cách bằng dấu phẩy' },
  { name: 'cohorts', label: 'Khóa áp dụng', placeholder: 'VD: K66, K67' },
] as const;

export default function UploadPdfDialog({ open, onClose, onSubmit }: any) {
  const { control, handleSubmit, watch, reset, setValue } = useForm<any>({
    defaultValues: {
      title: '',
      description: '',
      document_type: 'other',
      document_number: '',
      issuer: '',
      issuing_unit: '',
      issued_date: '',
      valid_from: '',
      valid_to: '',
      academic_year: '',
      semester: '',
      audiences: '',
      education_levels: '',
      study_modes: '',
      faculties: '',
      programs: '',
      campuses: '',
      cohorts: '',
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
    [
      'document_type',
      'document_number',
      'issuer',
      'issuing_unit',
      'issued_date',
      'valid_from',
      'valid_to',
      'academic_year',
      'semester',
      'audiences',
      'education_levels',
      'study_modes',
      'faculties',
      'programs',
      'campuses',
      'cohorts',
    ].forEach((field) => {
      if (data[field]) formData.append(field, data[field]);
    });
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

          <Typography variant="subtitle2" fontWeight={800} color="#334155">
            Metadata tra cứu
          </Typography>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
            <Controller
              name="document_type"
              control={control}
              render={({ field }) => (
                <TextField {...field} select size="small" label="Loại văn bản" fullWidth>
                  <MenuItem value="quy_che">Quy chế</MenuItem>
                  <MenuItem value="quyet_dinh">Quyết định</MenuItem>
                  <MenuItem value="thong_bao">Thông báo</MenuItem>
                  <MenuItem value="huong_dan">Hướng dẫn</MenuItem>
                  <MenuItem value="quy_trinh">Quy trình</MenuItem>
                  <MenuItem value="phu_luc">Phụ lục</MenuItem>
                  <MenuItem value="other">Khác / tự nhận diện</MenuItem>
                </TextField>
              )}
            />
            <Controller
              name="issued_date"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" size="small" label="Ngày ban hành" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
            <Controller
              name="valid_from"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" size="small" label="Hiệu lực từ" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
            <Controller
              name="valid_to"
              control={control}
              render={({ field }) => (
                <TextField {...field} type="date" size="small" label="Hiệu lực đến" fullWidth InputLabelProps={{ shrink: true }} />
              )}
            />
            {metadataFields.map((metadataField) => (
              <Controller
                key={metadataField.name}
                name={metadataField.name}
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    label={metadataField.label}
                    placeholder={metadataField.placeholder}
                    fullWidth
                    inputProps={{ maxLength: 250 }}
                  />
                )}
              />
            ))}
          </Box>

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
