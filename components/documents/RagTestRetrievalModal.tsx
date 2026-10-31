'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Search, Sparkles, FileText, CheckCircle2, Sliders, X } from 'lucide-react';

interface RagTestRetrievalModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RagTestRetrievalModal({ open, onClose }: RagTestRetrievalModalProps) {
  const [query, setQuery] = useState('Mức học phí tín chỉ ngành Công nghệ thông tin năm 2025?');
  const [topK, setTopK] = useState(3);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handleTestSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setResults([
        {
          id: 1,
          score: 94.8,
          document: 'Quy chế Đào tạo và Học phí Khoa CNTT.pdf',
          version: 'v2.1 (Active)',
          chunk:
            'Học phí ngành Công nghệ thông tin áp dụng cho khóa tuyển sinh 2025 là 450.000đ/tín chỉ đối với các học phần đại cương và 520.000đ/tín chỉ đối với học phần chuyên ngành.',
        },
        {
          id: 2,
          score: 82.3,
          document: 'Thông báo Tuyển sinh ĐH Chính quy 2025.pdf',
          version: 'v1.0 (Active)',
          chunk:
            'Mức thu học phí tạm thu đầu khóa cho sinh viên K70 ngành CNTT là 5.000.000đ cho kỳ học đầu tiên.',
        },
      ]);
      setIsSearching(false);
    }, 600);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(8px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '12px',
          p: 1.5,
          backgroundColor: '#ffffff',
          boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
          border: '1px solid rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Sparkles className="w-6 h-6 text-[#1f2937]" />
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Thử nghiệm Semantic Retrieval RAG (Test Query)
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Nhập câu hỏi mẫu để kiểm tra các Chunk context nào được RAG Agent truy xuất trước khi public
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 1 }}>
        <Box display="flex" gap={1.5} mb={3} mt={1} flexWrap={{ xs: 'wrap', sm: 'nowrap' }}>
          <TextField
            fullWidth
            size="small"
            label="Câu hỏi mẫu cần test RAG retrieval"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: '#f8f8f8',
                '&.Mui-focused fieldset': { borderColor: '#1f2937' },
              },
            }}
          />

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 130 } }}>
            <Select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              sx={{
                borderRadius: '12px',
                bgcolor: '#f8f8f8',
                '&.Mui-focused fieldset': { borderColor: '#1f2937' },
              }}
            >
              <MenuItem value={1}>Top K = 1</MenuItem>
              <MenuItem value={3}>Top K = 3</MenuItem>
              <MenuItem value={5}>Top K = 5</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<Search className="w-4 h-4" />}
            onClick={handleTestSearch}
            sx={{
              borderRadius: '8px',
              backgroundColor: '#1f2937',
              color: '#ffffff',
              fontWeight: 600,
              px: 3,
              py: 1,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 'auto',
              boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.12)',
              '&:hover': {
                backgroundColor: '#111827',
                boxShadow: '0 6px 18px -2px rgba(0, 0, 0, 0.12)',
              },
            }}
          >
            Chạy thử
          </Button>
        </Box>

        {isSearching && (
          <LinearProgress
            sx={{
              my: 2.5,
              height: 6,
              borderRadius: '8px',
              bgcolor: 'rgba(0, 0, 0, 0.08)',
              '& .MuiLinearProgress-bar': { bgcolor: '#1f2937', borderRadius: '8px' },
            }}
          />
        )}

        {results && (
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#1f2937', fontSize: '0.875rem' }}>
              Kết quả Trích xuất Context Chunks ({results.length} đoạn tương đồng nhất):
            </Typography>

            {results.map((res, i) => (
              <Box
                key={res.id}
                p={2.5}
                borderRadius="18px"
                border="1px solid rgba(0, 0, 0, 0.12)"
                bgcolor="#f8f8f8"
                boxShadow="0 2px 8px -2px rgba(0, 0, 0, 0.04)"
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                  <Box display="flex" alignItems="center" gap={1.2}>
                    <span className="text-xs font-semibold text-white bg-[#1f2937] px-2 py-0.5 rounded-md">
                      #{i + 1}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{res.document}</span>
                    <Chip
                      size="small"
                      label={res.version}
                      sx={{
                        borderRadius: '8px',
                        fontSize: '0.675rem',
                        fontWeight: 600,
                        bgcolor: '#f3f4f6',
                        color: '#1f2937',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                      }}
                    />
                  </Box>
                  <Chip
                    size="small"
                    label={`${res.score}% Cosine Match`}
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.725rem',
                      backgroundColor: '#f3f4f6',
                      color: '#1f2937',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  color="slate.800"
                  p={2}
                  borderRadius="12px"
                  bgcolor="#ffffff"
                  border="1px solid rgba(0, 0, 0, 0.08)"
                  sx={{ lineHeight: 1.6, fontWeight: 500, fontSize: '0.85rem' }}
                >
                  &quot;{res.chunk}&quot;
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '8px',
            px: 3.5,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            color: '#4b5563',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            '&:hover': { bgcolor: '#f3f4f6', color: '#1f2937' },
          }}
        >
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}

