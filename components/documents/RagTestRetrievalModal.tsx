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
          <Sparkles className="w-6 h-6 text-[#0d8a4f]" />
          <Box>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#0d8a4f', fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
                bgcolor: '#f8fbf9',
                '&.Mui-focused fieldset': { borderColor: '#0d8a4f' },
              },
            }}
          />

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 130 } }}>
            <Select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              sx={{
                borderRadius: '12px',
                bgcolor: '#f8fbf9',
                '&.Mui-focused fieldset': { borderColor: '#0d8a4f' },
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
              borderRadius: '9999px',
              backgroundColor: '#0d8a4f',
              color: '#ffffff',
              fontWeight: 800,
              px: 3,
              py: 1,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 'auto',
              boxShadow: '0 4px 14px -2px rgba(13, 138, 79, 0.35)',
              '&:hover': {
                backgroundColor: '#0a7543',
                boxShadow: '0 6px 18px -2px rgba(13, 138, 79, 0.45)',
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
              borderRadius: '9999px',
              bgcolor: 'rgba(13, 138, 79, 0.08)',
              '& .MuiLinearProgress-bar': { bgcolor: '#0d8a4f', borderRadius: '9999px' },
            }}
          />
        )}

        {results && (
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0d8a4f', fontSize: '0.875rem' }}>
              Kết quả Trích xuất Context Chunks ({results.length} đoạn tương đồng nhất):
            </Typography>

            {results.map((res, i) => (
              <Box
                key={res.id}
                p={2.5}
                borderRadius="18px"
                border="1px solid rgba(13, 138, 79, 0.12)"
                bgcolor="#fbfdfc"
                boxShadow="0 2px 8px -2px rgba(13, 138, 79, 0.04)"
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                  <Box display="flex" alignItems="center" gap={1.2}>
                    <span className="text-xs font-black text-white bg-[#0d8a4f] px-2 py-0.5 rounded-md">
                      #{i + 1}
                    </span>
                    <span className="text-xs font-black text-slate-800">{res.document}</span>
                    <Chip
                      size="small"
                      label={res.version}
                      sx={{
                        borderRadius: '9999px',
                        fontSize: '0.675rem',
                        fontWeight: 800,
                        bgcolor: '#f0f8f4',
                        color: '#0d8a4f',
                        border: '1px solid rgba(13, 138, 79, 0.2)',
                      }}
                    />
                  </Box>
                  <Chip
                    size="small"
                    label={`${res.score}% Cosine Match`}
                    sx={{
                      borderRadius: '9999px',
                      fontWeight: 800,
                      fontSize: '0.725rem',
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                    }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  color="slate.800"
                  p={2}
                  borderRadius="12px"
                  bgcolor="#ffffff"
                  border="1px solid rgba(13, 138, 79, 0.08)"
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
            borderRadius: '9999px',
            px: 3.5,
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
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}

